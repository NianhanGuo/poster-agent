import type { ReferenceAnalysis } from "@/types/poster";
import type { PaletteColor } from "@/lib/colorExtract";

export interface EnrichedRefCtx {
  strength: number;
  targets: Record<string, boolean>;
  instruction?: string;
  palette?: PaletteColor[];
  analysis?: ReferenceAnalysis | null;
}

function strengthLabel(s: number): string {
  if (s >= 71) return "STRICT — override style defaults if needed";
  if (s >= 31) return "NOTICEABLE — visibly influence, balance with style recipe";
  return "LOOSE — subtle inspiration only";
}

/**
 * Builds a structured reference section to inject into any AI prompt.
 * Returns an empty string when there are no active targets and no instruction.
 */
export function buildReferenceSection(
  ref: EnrichedRefCtx,
  purpose: "image" | "layout" | "brief" | "typography",
): string {
  const { strength, targets, palette, analysis, instruction } = ref;
  const activeTargets = Object.entries(targets)
    .filter(([, v]) => v)
    .map(([k]) => k);

  if (activeTargets.length === 0 && !instruction?.trim()) return "";

  const label = strengthLabel(strength);
  const lines: string[] = [
    `\nREFERENCE IMAGE GUIDANCE — strength ${strength}/100 — ${label}:`,
  ];

  // Visual summary (always shown when analysis available — orients the AI)
  if (analysis?.visualSummary) {
    lines.push(`Visual reference: "${analysis.visualSummary}"`);
  }

  // ── Mood ────────────────────────────────────────────────────────────────────
  if (targets.mood && analysis?.mood) {
    lines.push(`Mood to capture: ${analysis.mood}`);
  }

  // ── Color palette ────────────────────────────────────────────────────────────
  if (targets.color && palette && palette.length > 0) {
    const swatches = palette.map((p) => `${p.hex}(${p.role})`).join(", ");
    const dominant = palette[0]?.hex;
    const accent =
      palette.find((p) => p.role === "accent")?.hex ??
      palette.find((p) => p.role === "highlight")?.hex ??
      palette[1]?.hex;
    const body =
      palette.find((p) => p.role === "highlight")?.hex ??
      palette[2]?.hex;

    lines.push(`Color palette: ${swatches}`);

    if (strength >= 71) {
      if (dominant) lines.push(`  → Background / dominant field MUST use: ${dominant}`);
      if (accent)   lines.push(`  → Accent / title fill MUST use: ${accent}`);
      if (body)     lines.push(`  → Body / secondary fill MUST use: ${body}`);
      lines.push(`  → Do NOT introduce colors outside this palette.`);
    } else if (strength >= 31) {
      lines.push(`  → Let these colors dominate the atmosphere and primary fills.`);
    } else {
      lines.push(`  → Draw loose inspiration from these hues.`);
    }

    // Supplement with vision-extracted palette when different
    if (analysis?.palette?.length) {
      const visionHex = analysis.palette.join(", ");
      lines.push(`  Vision-confirmed palette: ${visionHex}`);
    }
  }

  // ── Background style ────────────────────────────────────────────────────────
  if (targets.backgroundStyle && analysis) {
    lines.push(`Background treatment: ${analysis.shapes}. Surface: ${analysis.texture}.`);
    if (purpose === "image") {
      lines.push(
        `Generate a background that matches this abstract treatment — do NOT copy subject matter.`,
      );
    }
  }

  // ── Composition / layout ────────────────────────────────────────────────────
  if (targets.layout && analysis?.composition) {
    lines.push(`Spatial composition: ${analysis.composition}`);
    if (purpose === "layout" || purpose === "brief") {
      lines.push(`  → Mirror this spatial hierarchy and negative-space distribution.`);
    }
    if (purpose === "image") {
      lines.push(`  → Leave negative space in matching areas of the frame.`);
    }
  }

  // ── Typography ───────────────────────────────────────────────────────────────
  if (targets.typography && analysis?.typographyStyle) {
    lines.push(`Typography style reference: ${analysis.typographyStyle}`);
    lines.push(`  → Copy the visual treatment only — do NOT reproduce the actual words.`);
  }

  // ── Texture / material ───────────────────────────────────────────────────────
  if (targets.texture && analysis?.texture) {
    lines.push(`Texture / material feel: ${analysis.texture}`);
  }

  // ── Lighting ─────────────────────────────────────────────────────────────────
  if (targets.lighting && analysis?.lighting) {
    lines.push(`Lighting atmosphere: ${analysis.lighting}`);
  }

  // ── User instruction (always included) ──────────────────────────────────────
  if (instruction?.trim()) {
    lines.push(`User instruction: ${instruction.trim()}`);
  }

  return lines.join("\n");
}
