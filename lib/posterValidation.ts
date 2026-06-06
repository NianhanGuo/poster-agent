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
    | "focal-overlap"
    // Design-quality checks (added by validateDesignQuality)
    | "hierarchy"               // title not clearly dominant
    | "composition-relationship"// text/shape isolated from composition
    | "subject-coverage";       // primary visual accidentally obscured
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

// ─── Collage-specific validation ─────────────────────────────────────────────

/**
 * Additional validation rules for the collage-poster recipe.
 * Runs after the standard validatePosterLayout checks.
 */
export function validateCollageLayout(
  layers: PosterLayer[],
  canvas: CanvasConfig,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const W = canvas.width;
  const H = canvas.height;

  const subjectLayers    = layers.filter((l) => l.type === "subjectImage" && l.visible);
  const shapeLayers      = layers.filter((l) => l.type === "geometricShape" && l.visible);
  const titleLayer       = layers.find((l) => l.type === "titleText" && l.visible);
  const hasGradientLayer = layers.some((l) => l.type === "gradientLayer" || l.type === "colorOverlay");

  // 1. No gradients or overlays — collage uses flat fills only
  if (hasGradientLayer) {
    const offenders = layers.filter((l) => l.type === "gradientLayer" || l.type === "colorOverlay");
    for (const l of offenders) {
      issues.push({
        type:       "focal-overlap",
        layerId:    l.id,
        layerLabel: l.label,
        message:    `Collage mode: "${l.label}" uses gradientLayer/colorOverlay — only flat geometricShape fills are allowed`,
        severity:   "error",
        suggestedFix: `Convert to geometricShape with shapeData.fill (flat solid color)`,
      });
    }
  }

  // 2. Unreplaced subject placeholders
  for (const l of subjectLayers) {
    if (l.imageData?.src?.startsWith("__SUBJECT_")) {
      issues.push({
        type:       "out-of-canvas",
        layerId:    l.id,
        layerLabel: l.label,
        message:    `Subject placeholder "${l.imageData.src}" was not replaced with actual image data`,
        severity:   "error",
        suggestedFix: `Inject the processed subject image data URL into imageData.src`,
      });
    }
  }

  // 3. Subject-shape overlap: at least one subject must overlap a shape
  if (subjectLayers.length > 0 && shapeLayers.length > 0) {
    let anyOverlap = false;
    for (const subject of subjectLayers) {
      const sAabb = rotatedAABB(subject.x, subject.y, subject.width, subject.height, subject.rotation ?? 0);
      for (const shape of shapeLayers) {
        const shAabb = rotatedAABB(shape.x, shape.y, shape.width, shape.height, shape.rotation ?? 0);
        const overlapX = Math.max(0, Math.min(sAabb.right, shAabb.right) - Math.max(sAabb.x, shAabb.x));
        const overlapY = Math.max(0, Math.min(sAabb.bottom, shAabb.bottom) - Math.max(sAabb.y, shAabb.y));
        if (overlapX > 20 && overlapY > 20) {
          anyOverlap = true;
          break;
        }
      }
      if (anyOverlap) break;
    }
    if (!anyOverlap) {
      issues.push({
        type:       "focal-overlap",
        layerId:    subjectLayers[0].id,
        layerLabel: subjectLayers[0].label,
        message:    `Collage mode: no subject overlaps any geometric shape — composition feels like isolated elements`,
        severity:   "error",
        suggestedFix: `Move subject_0 to overlap the primary shape by at least 20px on each axis`,
      });
    }
  }

  // 4. Title must interact with composition (has overlap with subject or shape)
  if (titleLayer) {
    const tAabb = rotatedAABB(titleLayer.x, titleLayer.y, titleLayer.width, titleLayer.height, titleLayer.rotation ?? 0);
    let titleInteracts = false;

    const allCompositionLayers = [...subjectLayers, ...shapeLayers];
    for (const other of allCompositionLayers) {
      const oAabb = rotatedAABB(other.x, other.y, other.width, other.height, other.rotation ?? 0);
      const dx = Math.min(tAabb.right, oAabb.right) - Math.max(tAabb.x, oAabb.x);
      const dy = Math.min(tAabb.bottom, oAabb.bottom) - Math.max(tAabb.y, oAabb.y);
      // Count edge-alignment (within 15px) or overlap as interaction
      const edgeAlignedH = Math.abs(tAabb.x - oAabb.x) < 15 || Math.abs(tAabb.right - oAabb.right) < 15 || Math.abs(tAabb.x - oAabb.right) < 30;
      const edgeAlignedV = Math.abs(tAabb.y - oAabb.bottom) < 30 || Math.abs(tAabb.bottom - oAabb.y) < 30;
      if ((dx > 0 && dy > 0) || edgeAlignedH || edgeAlignedV) {
        titleInteracts = true;
        break;
      }
    }
    if (!titleInteracts && allCompositionLayers.length > 0) {
      issues.push({
        type:       "safe-margin",
        layerId:    titleLayer.id,
        layerLabel: titleLayer.label,
        message:    `Collage mode: title "${titleLayer.label}" floats without relationship to subjects or shapes`,
        severity:   "warning",
        suggestedFix: `Move title to overlap or align (within 15px) with a shape edge or subject boundary`,
      });
    }
  }

  // 5. No subjects at all (collage mode requires at least one)
  if (subjectLayers.length === 0) {
    issues.push({
      type:       "out-of-canvas",
      layerId:    "missing",
      layerLabel: "(no subject)",
      message:    `Collage mode: no subjectImage layers found — composition requires at least one uploaded subject`,
      severity:   "error",
      suggestedFix: `Add at least one subjectImage layer with src="__SUBJECT_0__"`,
    });
  }

  // 6. Subject must be visible (reasonable size)
  for (const l of subjectLayers) {
    const minDim = Math.min(W, H) * 0.25;
    if (l.width < minDim || l.height < minDim) {
      issues.push({
        type:       "small-font",
        layerId:    l.id,
        layerLabel: l.label,
        message:    `Subject "${l.label}" is very small (${Math.round(l.width)}×${Math.round(l.height)}px) — collage subjects should be prominent`,
        severity:   "warning",
        suggestedFix: `Increase subject size to at least ${Math.round(minDim)}px on each side`,
      });
    }
  }

  return issues;
}

// ─── Design-quality validation ────────────────────────────────────────────────
//
// These rules go beyond geometry and check whether the composition is
// coherent as a designed object. They run server-side (no AI needed) and
// feed into the Director's repair prompt when violations are found.

/**
 * Checks that the title is clearly dominant over body / subtitle text.
 * Ratio threshold: titleFontSize must be ≥ 1.5× any subordinate layer's fontSize.
 */
export function validateHierarchy(layers: PosterLayer[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const title = layers.find((l) => l.type === "titleText" && l.visible);
  if (!title) return issues;
  const titleSize = title.textData?.fontSize ?? 0;
  if (titleSize === 0) return issues;

  const subordinate = layers.filter(
    (l) =>
      (l.type === "subtitleText" || l.type === "bodyText" || l.type === "metaText") &&
      l.visible &&
      (l.textData?.fontSize ?? 0) > 0,
  );

  for (const sub of subordinate) {
    const subSize = sub.textData!.fontSize!;
    if (subSize >= titleSize * 0.67) {
      // secondary text is more than 2/3 the title size → hierarchy unclear
      issues.push({
        type:       "hierarchy",
        layerId:    title.id,
        layerLabel: title.label,
        message:
          `Title "${title.label}" (${titleSize}px) is not clearly dominant over ` +
          `"${sub.label}" (${subSize}px) — ratio ${(titleSize / subSize).toFixed(1)}×, needs ≥1.5×`,
        severity:     "warning",
        suggestedFix: `Increase titleText fontSize to at least ${Math.ceil(subSize * 1.8)}px`,
      });
      break; // one issue per title is enough
    }
  }
  return issues;
}

/**
 * Checks that every geometricShape (non-structural) has a spatial relationship
 * to at least one text or image layer within PROXIMITY px.
 * Shapes larger than 30% of canvas area are structural and exempt.
 */
export function validateDecorativeRelationships(
  layers: PosterLayer[],
  canvas: CanvasConfig,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const W = canvas.width;
  const H = canvas.height;
  const PROXIMITY = 60;

  const shapes = layers.filter(
    (l) =>
      l.type === "geometricShape" &&
      l.visible &&
      (l.shapeData?.fill ?? "none") !== "none",
  );
  const content = layers.filter(
    (l) =>
      l.visible &&
      l.type !== "solidBackground" &&
      l.type !== "noiseTexture" &&
      l.type !== "geometricShape" &&
      l.type !== "accentLine",
  );

  for (const shape of shapes) {
    if (shape.width * shape.height > W * H * 0.3) continue; // structural

    const sAabb = rotatedAABB(shape.x, shape.y, shape.width, shape.height, shape.rotation ?? 0);
    const related = content.some((c) => {
      const cAabb = rotatedAABB(c.x, c.y, c.width, c.height, c.rotation ?? 0);
      const dx =
        Math.min(sAabb.right + PROXIMITY, cAabb.right) -
        Math.max(sAabb.x - PROXIMITY, cAabb.x);
      const dy =
        Math.min(sAabb.bottom + PROXIMITY, cAabb.bottom) -
        Math.max(sAabb.y - PROXIMITY, cAabb.y);
      return dx > 0 && dy > 0;
    });

    if (!related) {
      issues.push({
        type:       "composition-relationship",
        layerId:    shape.id,
        layerLabel: shape.label,
        message:
          `Shape "${shape.label}" has no spatial relationship to any text or image — appears purely decorative`,
        severity:     "warning",
        suggestedFix: `Move the shape within ${PROXIMITY}px of at least one text or image layer`,
      });
    }
  }
  return issues;
}

/**
 * Checks that high-opacity decorative layers above a backgroundImage do not
 * cover more than 65% of it. Subject images are exempt (occlusion is intentional
 * in collage mode).
 */
export function validateSubjectVisibility(layers: PosterLayer[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const images = layers.filter((l) => l.type === "backgroundImage" && l.visible);
  const decorative = layers.filter(
    (l) =>
      (l.type === "geometricShape" || l.type === "colorOverlay" || l.type === "gradientLayer") &&
      l.visible &&
      (l.opacity ?? 1) > 0.55,
  );

  for (const img of images) {
    const iAabb = rotatedAABB(img.x, img.y, img.width, img.height, img.rotation ?? 0);
    const iArea = (iAabb.right - iAabb.x) * (iAabb.bottom - iAabb.y);
    if (iArea === 0) continue;

    for (const dec of decorative) {
      if ((dec.zIndex ?? 0) <= (img.zIndex ?? 0)) continue;
      const dAabb = rotatedAABB(dec.x, dec.y, dec.width, dec.height, dec.rotation ?? 0);
      const ox = Math.max(0, Math.min(iAabb.right, dAabb.right) - Math.max(iAabb.x, dAabb.x));
      const oy = Math.max(0, Math.min(iAabb.bottom, dAabb.bottom) - Math.max(iAabb.y, dAabb.y));
      const fraction = (ox * oy) / iArea;
      if (fraction > 0.65) {
        issues.push({
          type:       "subject-coverage",
          layerId:    dec.id,
          layerLabel: dec.label,
          message:
            `"${dec.label}" (opacity ${Math.round((dec.opacity ?? 1) * 100)}%) covers ` +
            `${Math.round(fraction * 100)}% of background image "${img.label}" — primary visual accidentally hidden`,
          severity:     "warning",
          suggestedFix: `Reduce opacity to ≤0.4, reposition, or lower zIndex below the image layer`,
        });
      }
    }
  }
  return issues;
}

/**
 * Checks that the title has a spatial relationship (proximity ≤ THRESHOLD px or
 * direct overlap) to at least one image or shape anchor.
 * Floating titles disconnected from the composition feel like clip-art.
 */
export function validateTextCompositionRelationship(layers: PosterLayer[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const THRESHOLD = 140;

  const title = layers.find((l) => l.type === "titleText" && l.visible);
  if (!title) return issues;

  const anchors = layers.filter(
    (l) =>
      l.visible &&
      (l.type === "backgroundImage" || l.type === "subjectImage" || l.type === "geometricShape"),
  );
  if (anchors.length === 0) return issues;

  const tAabb = rotatedAABB(title.x, title.y, title.width, title.height, title.rotation ?? 0);
  const connected = anchors.some((a) => {
    const aAabb = rotatedAABB(a.x, a.y, a.width, a.height, a.rotation ?? 0);
    const dx =
      Math.min(tAabb.right + THRESHOLD, aAabb.right) -
      Math.max(tAabb.x - THRESHOLD, aAabb.x);
    const dy =
      Math.min(tAabb.bottom + THRESHOLD, aAabb.bottom) -
      Math.max(tAabb.y - THRESHOLD, aAabb.y);
    return dx > 0 && dy > 0;
  });

  if (!connected) {
    issues.push({
      type:       "composition-relationship",
      layerId:    title.id,
      layerLabel: title.label,
      message:
        `Title "${title.label}" floats in isolation — more than ${THRESHOLD}px from all image and shape layers`,
      severity:     "warning",
      suggestedFix: `Move the title within ${THRESHOLD}px of the primary image or geometric shape`,
    });
  }
  return issues;
}

/**
 * Runs all four design-quality checks.
 * Call this in addition to validatePosterLayout() for a complete review.
 */
export function validateDesignQuality(
  layers: PosterLayer[],
  canvas: CanvasConfig,
): ValidationIssue[] {
  return [
    ...validateHierarchy(layers),
    ...validateDecorativeRelationships(layers, canvas),
    ...validateSubjectVisibility(layers),
    ...validateTextCompositionRelationship(layers),
  ];
}

// ─── Product Exhibit–specific validation ──────────────────────────────────────

/**
 * Enforces the "product is the hero" rule.
 *
 * Checks:
 *  1. Product layer (backgroundImage with label containing "product") exists
 *  2. Product layer occupies ≥ 25% of canvas area (hard minimum)
 *  3. Title fontSize is not dominating the product (warns if headline > 80px
 *     while product is smaller than 35% canvas)
 *  4. Brand/feature system present (at least one feature or trust layer)
 */
export function validateProductExhibitLayout(
  layers: PosterLayer[],
  canvas: CanvasConfig,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const W = canvas.width;
  const H = canvas.height;
  const canvasArea = W * H;
  const MIN_PRODUCT_FRACTION = 0.25;

  // Find the product/hero layer
  const productLayer = layers.find(
    (l) =>
      l.visible &&
      l.type === "backgroundImage" &&
      (l.label?.toLowerCase().includes("product") || l.label?.toLowerCase().includes("hero")),
  );

  if (!productLayer) {
    issues.push({
      type:         "focal-overlap",
      layerId:      "missing-product",
      layerLabel:   "product/hero",
      message:      "No product/hero layer found. Product Exhibit requires a backgroundImage layer labeled 'product/hero'.",
      severity:     "error",
      suggestedFix: "Add a backgroundImage layer with label 'product/hero' and large dimensions (≥40% canvas area).",
    });
    return issues;
  }

  // Compute visible product area from clipShape (more accurate) or layer bounds
  let productW = productLayer.width;
  let productH = productLayer.height;
  const cs = productLayer.clipShape;
  if (cs?.type === "rect" && cs.width && cs.height) {
    productW = cs.width;
    productH = cs.height;
  } else if (cs?.type === "circle" && cs.radius) {
    const area = Math.PI * cs.radius * cs.radius;
    const fraction = area / canvasArea;
    if (fraction < MIN_PRODUCT_FRACTION) {
      issues.push({
        type:         "subject-coverage",
        layerId:      productLayer.id,
        layerLabel:   productLayer.label,
        message:      `Product hero circle (r=${cs.radius}px) covers only ${Math.round(fraction * 100)}% of canvas. ` +
          `Minimum is ${Math.round(MIN_PRODUCT_FRACTION * 100)}%. The product must be the visual hero.`,
        severity:     "error",
        suggestedFix: `Increase product radius to at least ${Math.round(Math.sqrt(canvasArea * MIN_PRODUCT_FRACTION / Math.PI))}px.`,
      });
    }
    return issues;
  }

  const productArea = productW * productH;
  const productFraction = productArea / canvasArea;

  if (productFraction < MIN_PRODUCT_FRACTION) {
    issues.push({
      type:         "subject-coverage",
      layerId:      productLayer.id,
      layerLabel:   productLayer.label,
      message:
        `Product hero "${productLayer.label}" covers only ${Math.round(productFraction * 100)}% of canvas ` +
        `(${Math.round(productW)}×${Math.round(productH)}px). ` +
        `Minimum is ${Math.round(MIN_PRODUCT_FRACTION * 100)}%. ` +
        `The product must be the dominant visual element.`,
      severity:     "error",
      suggestedFix:
        `Increase product/hero to at least: width=${Math.round(W * 0.50)}px, height=${Math.round(H * 0.55)}px ` +
        `(≥${Math.round(MIN_PRODUCT_FRACTION * 100)}% canvas area). ` +
        `Shrink the headline if needed — typography must yield to the product.`,
    });
  }

  // Warn when headline is very large relative to the (still small) product
  const titleLayer = layers.find((l) => l.type === "titleText" && l.visible);
  const titleFontSize = titleLayer?.textData?.fontSize ?? 0;
  if (productFraction < 0.35 && titleFontSize > 80) {
    issues.push({
      type:         "hierarchy",
      layerId:      titleLayer!.id,
      layerLabel:   titleLayer!.label,
      message:
        `text/product-name fontSize=${titleFontSize}px is very large while product covers ` +
        `only ${Math.round(productFraction * 100)}% of canvas. ` +
        `Typography is dominating the product.`,
      severity:     "warning",
      suggestedFix:
        `Either: (A) reduce headline fontSize to ≤60px, ` +
        `OR (B) increase product/hero dimensions to ≥35% canvas. ` +
        `The product must visually outweigh the headline.`,
    });
  }

  // Warn if no brand/feature system is present
  const hasBrandOrFeature = layers.some(
    (l) =>
      l.visible &&
      (l.label?.startsWith("feature/") ||
        l.label?.startsWith("trust/") ||
        l.label?.startsWith("brand/") ||
        l.label === "text/brand"),
  );
  if (!hasBrandOrFeature) {
    issues.push({
      type:         "composition-relationship",
      layerId:      productLayer.id,
      layerLabel:   "brand/feature system",
      message:
        "No feature/, trust/, or brand/ layers found. " +
        "Product Exhibit requires a brand system: brand name, feature callouts, and trust signals.",
      severity:     "warning",
      suggestedFix:
        "Add at least: text/brand (brand name), feature/01 + feature/02 (2 feature lines), " +
        "and trust/label-01 (1 quality signal).",
    });
  }

  return issues;
}

// ─── Issue formatter for Creative Director prompt ─────────────────────────────

export function formatIssuesForDirector(issues: ValidationIssue[]): string {
  if (issues.length === 0) return "No issues found.";

  const repairGuide: Partial<Record<ValidationIssue["type"], string>> = {
    "out-of-canvas":
      "Constrain x≥0, y≥0, x+width≤canvasWidth, y+height≤canvasHeight. Reduce rotation if AABB overflows.",
    "safe-margin":
      "Move text to x≥40, y≥40, x+width≤canvasWidth-40, y+height≤canvasHeight-40. Reduce fontSize if too wide.",
    "small-font":
      "Increase fontSize to the minimum listed in the issue.",
    "low-opacity":
      "Set opacity ≥ 0.2.",
    "z-order":
      "Set titleText zIndex ≥ solidBackground zIndex + 3.",
    "focal-overlap":
      "Reduce decorative layer opacity to ≤0.35 or reposition it away from the focal image.",
    "hierarchy":
      "Increase the titleText fontSize until it is at least 1.8× the largest subordinate text layer.",
    "composition-relationship":
      "Move the isolated layer within 60–140px of the nearest image or shape anchor, or overlap it slightly.",
    "subject-coverage":
      "Reduce the covering layer's opacity to ≤0.4, move it, or lower its zIndex below the image.",
  };

  return issues
    .map(
      (issue, i) =>
        `Issue ${i + 1} [${issue.severity.toUpperCase()}] type="${issue.type}"\n` +
        `  Layer: "${issue.layerLabel}" (id: ${issue.layerId})\n` +
        `  Problem: ${issue.message}\n` +
        `  Required fix: ${issue.suggestedFix}\n` +
        `  Repair guide: ${repairGuide[issue.type] ?? issue.suggestedFix}`,
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
