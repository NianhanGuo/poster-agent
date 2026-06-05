/**
 * Poster layout validation — geometry, bounds, safe margins, hierarchy.
 *
 * Run server-side after draft layer generation and before returning layers to
 * the client. Issues are fed to the CreativeDirectorAgent for repair.
 */

import type { PosterLayer, CanvasConfig } from "@/types/poster";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidationIssue {
  type:
    | "out-of-canvas"
    | "safe-margin"
    | "small-font"
    | "low-opacity"
    | "z-order"
    | "focal-overlap";
  layerId: string;
  layerLabel: string;
  message: string;
  severity: "error" | "warning";
  suggestedFix: string;
}

interface AABB {
  x: number;
  y: number;
  right: number;
  bottom: number;
}

// ─── Layer classification ─────────────────────────────────────────────────────

const TEXT_TYPES = new Set([
  "titleText", "subtitleText", "metaText", "bodyText", "userText",
]);
const BACKGROUND_TYPES = new Set([
  "solidBackground", "noiseTexture", "textureLayer",
]);
const DECORATIVE_TYPES = new Set([
  "geometricShape", "colorOverlay", "gradientLayer",
]);

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/**
 * Computes the axis-aligned bounding box of a rotated rectangle.
 * Works in canvas coordinates (top-left origin, Konva convention).
 */
export function rotatedAABB(
  x: number,
  y: number,
  width: number,
  height: number,
  rotDeg: number,
): AABB {
  if (rotDeg === 0) {
    return { x, y, right: x + width, bottom: y + height };
  }
  const cx = x + width / 2;
  const cy = y + height / 2;
  const θ = (rotDeg * Math.PI) / 180;
  const cosA = Math.abs(Math.cos(θ));
  const sinA = Math.abs(Math.sin(θ));
  const w2 = width * cosA + height * sinA;
  const h2 = width * sinA + height * cosA;
  return {
    x:      cx - w2 / 2,
    y:      cy - h2 / 2,
    right:  cx + w2 / 2,
    bottom: cy + h2 / 2,
  };
}

/**
 * Derives the focal area AABB from the backgroundImage or subjectImage clipShape.
 * Returns null if no clipped image is found.
 */
export function computeFocalAABB(layers: PosterLayer[]): AABB | null {
  const focal = layers.find(
    (l) =>
      (l.type === "backgroundImage" || l.type === "subjectImage") && l.clipShape,
  );
  if (!focal?.clipShape) return null;
  const cs = focal.clipShape;
  if (
    cs.type === "rect" &&
    cs.x !== undefined &&
    cs.y !== undefined &&
    cs.width !== undefined &&
    cs.height !== undefined
  ) {
    return { x: cs.x, y: cs.y, right: cs.x + cs.width, bottom: cs.y + cs.height };
  }
  if (
    cs.type === "circle" &&
    cs.cx !== undefined &&
    cs.cy !== undefined &&
    cs.radius !== undefined
  ) {
    return {
      x:      cs.cx - cs.radius,
      y:      cs.cy - cs.radius,
      right:  cs.cx + cs.radius,
      bottom: cs.cy + cs.radius,
    };
  }
  return null;
}

function overlapFraction(a: AABB, b: AABB): number {
  const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
  const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
  const overlapArea = overlapX * overlapY;
  const bArea = (b.right - b.x) * (b.bottom - b.y);
  return bArea > 0 ? overlapArea / bArea : 0;
}

// ─── Main validation ──────────────────────────────────────────────────────────

export function validatePosterLayout(
  layers: PosterLayer[],
  canvas: CanvasConfig,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const W = canvas.width;
  const H = canvas.height;
  const SAFE_MARGIN = 40;
  const MIN_TEXT_FONT = 8;
  const MIN_TITLE_FONT = 16;
  const MIN_VISIBLE_OPACITY = 0.08;
  const CANVAS_TOLERANCE = 5; // px grace for floating-point rounding

  const focalAABB = computeFocalAABB(layers);
  const titleLayer = layers.find((l) => l.type === "titleText" && l.visible);
  const bgLayer    = layers.find((l) => l.type === "solidBackground" && l.visible);

  for (const layer of layers) {
    if (!layer.visible) continue;
    // Skip true full-canvas background types — they're always expected to fill
    if (BACKGROUND_TYPES.has(layer.type)) continue;

    const { x, y, width, height } = layer;
    const rot  = layer.rotation ?? 0;
    const aabb = rotatedAABB(x, y, width, height, rot);
    const isText      = TEXT_TYPES.has(layer.type);
    const isDecorative = DECORATIVE_TYPES.has(layer.type);
    const isAccentLine = layer.type === "accentLine"; // intentional full-width

    // ── 1. Out-of-canvas bounds ───────────────────────────────────────────────
    if (!isAccentLine) {
      const offRight  = aabb.right  > W + CANVAS_TOLERANCE;
      const offBottom = aabb.bottom > H + CANVAS_TOLERANCE;
      const offLeft   = aabb.x      < -CANVAS_TOLERANCE;
      const offTop    = aabb.y      < -CANVAS_TOLERANCE;

      if (offRight || offBottom || offLeft || offTop) {
        issues.push({
          type:       "out-of-canvas",
          layerId:    layer.id,
          layerLabel: layer.label,
          message:
            `"${layer.label}" (${layer.type}) extends outside canvas. ` +
            `AABB [x:${Math.round(aabb.x)}, y:${Math.round(aabb.y)}, ` +
            `right:${Math.round(aabb.right)}, bottom:${Math.round(aabb.bottom)}] ` +
            `— canvas [0, 0, ${W}, ${H}]`,
          severity: "error",
          suggestedFix:
            `Constrain to: x=${Math.max(0, Math.round(x))}, y=${Math.max(0, Math.round(y))}, ` +
            `width=${Math.min(W - Math.max(0, Math.round(x)), Math.round(width))}, ` +
            `height=${Math.min(H - Math.max(0, Math.round(y)), Math.round(height))}. ` +
            (rot !== 0
              ? `Rotation is ${rot}° — reduce to 0° or resize so rotated AABB fits within canvas.`
              : ""),
        });
      }
    }

    // ── 2. Safe margins for text layers ──────────────────────────────────────
    if (isText) {
      const offL = aabb.x      < SAFE_MARGIN;
      const offT = aabb.y      < SAFE_MARGIN;
      const offR = aabb.right  > W - SAFE_MARGIN;
      const offB = aabb.bottom > H - SAFE_MARGIN;

      if (offL || offT || offR || offB) {
        const newX = Math.max(SAFE_MARGIN, Math.round(x));
        const newY = Math.max(SAFE_MARGIN, Math.round(y));
        const maxW = W - 2 * SAFE_MARGIN;
        const maxH = H - 2 * SAFE_MARGIN;
        issues.push({
          type:       "safe-margin",
          layerId:    layer.id,
          layerLabel: layer.label,
          message:
            `Text "${layer.label}" violates safe margins (${SAFE_MARGIN}px). ` +
            `AABB [x:${Math.round(aabb.x)}, y:${Math.round(aabb.y)}, ` +
            `right:${Math.round(aabb.right)}, bottom:${Math.round(aabb.bottom)}]`,
          severity: "error",
          suggestedFix:
            `Move to x=${newX}, y=${newY}; ` +
            `cap width≤${Math.min(maxW, Math.round(width))}, height≤${maxH}. ` +
            (offR && width > maxW ? `Text is wider than safe area — reduce fontSize proportionally.` : ""),
        });
      }

      // ── 3. Minimum font size ────────────────────────────────────────────────
      const fs = layer.textData?.fontSize ?? 0;
      if (fs > 0) {
        const isTitle = layer.type === "titleText";
        const minFont = isTitle ? MIN_TITLE_FONT : MIN_TEXT_FONT;
        if (fs < minFont) {
          issues.push({
            type:       "small-font",
            layerId:    layer.id,
            layerLabel: layer.label,
            message:    `"${layer.label}" fontSize=${fs}px is below minimum (${minFont}px for ${isTitle ? "title" : "body"} text)`,
            severity:   "warning",
            suggestedFix: `Increase fontSize to at least ${minFont}px`,
          });
        }
      }

      // ── 4. Minimum visible opacity for text ─────────────────────────────────
      const opacity = layer.opacity ?? 1;
      if (opacity < MIN_VISIBLE_OPACITY) {
        issues.push({
          type:       "low-opacity",
          layerId:    layer.id,
          layerLabel: layer.label,
          message:    `Text "${layer.label}" opacity=${opacity.toFixed(2)} (nearly invisible)`,
          severity:   "error",
          suggestedFix: `Increase opacity to at least 0.2`,
        });
      }
    }

    // ── 5. Decorative layer covering focal image ──────────────────────────────
    if (isDecorative && !isAccentLine && focalAABB) {
      const coverFraction = overlapFraction(aabb, focalAABB);
      const opacity = layer.opacity ?? 1;
      if (coverFraction > 0.6 && opacity > 0.55) {
        issues.push({
          type:       "focal-overlap",
          layerId:    layer.id,
          layerLabel: layer.label,
          message:
            `"${layer.label}" covers ${Math.round(coverFraction * 100)}% of the focal image ` +
            `at opacity ${opacity.toFixed(2)} — obscures main subject`,
          severity: "warning",
          suggestedFix: `Reduce opacity to ≤0.35, or reposition to avoid covering focal image`,
        });
      }
    }
  }

  // ── 6. Z-index order: title should be above solidBackground ─────────────────
  if (titleLayer && bgLayer) {
    if ((titleLayer.zIndex ?? 0) <= (bgLayer.zIndex ?? 0)) {
      issues.push({
        type:       "z-order",
        layerId:    titleLayer.id,
        layerLabel: titleLayer.label,
        message:    `Title layer zIndex (${titleLayer.zIndex}) ≤ solidBackground zIndex (${bgLayer.zIndex}) — title will be hidden`,
        severity:   "error",
        suggestedFix: `Set titleText zIndex to at least ${(bgLayer.zIndex ?? 0) + 3}`,
      });
    }
  }

  return issues;
}

// ─── Issue formatter for Creative Director prompt ─────────────────────────────

export function formatIssuesForDirector(issues: ValidationIssue[]): string {
  if (issues.length === 0) return "No issues found.";
  return issues
    .map(
      (issue, i) =>
        `Issue ${i + 1} [${issue.severity.toUpperCase()}] type="${issue.type}"\n` +
        `  Layer: "${issue.layerLabel}" (id: ${issue.layerId})\n` +
        `  Problem: ${issue.message}\n` +
        `  Required fix: ${issue.suggestedFix}`,
    )
    .join("\n\n");
}

// ─── Summary line for logging ──────────────────────────────────────────────────

export function summariseIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) return "✓ No issues";
  const errors   = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const types = [...new Set(issues.map((i) => i.type))].join(", ");
  return `${errors} error(s), ${warnings} warning(s) — types: ${types}`;
}
