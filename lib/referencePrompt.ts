import type { ReferenceAnalysis, ReferenceMode, ReferenceRole } from "@/types/poster";
import type { PaletteColor } from "@/lib/colorExtract";

// Per-image context sent from client to API routes
export interface RefImageCtx {
  id: string;
  mode: ReferenceMode;
  role: ReferenceRole;
  strength: number;
  targets: Record<string, boolean>;
  palette?: PaletteColor[];
  analysis?: ReferenceAnalysis | null;
}

// Full context passed to every AI call
export interface EnrichedRefCtx {
  // Legacy single-ref fields (backward compat)
  strength: number;
  targets: Record<string, boolean>;
  instruction?: string;
  palette?: PaletteColor[];
  analysis?: ReferenceAnalysis | null;

  // Multi-reference (new)
  references?: RefImageCtx[];
  globalInstruction?: string;
}

// ── Role priority for ordering ────────────────────────────────────────────────

const ROLE_ORDER: Record<ReferenceRole, number> = { primary: 0, secondary: 1, accent: 2 };

// ── Mode labels ───────────────────────────────────────────────────────────────

function modeLabel(mode: ReferenceMode): string {
  if (mode === "strict")   return "STRICT — mandatory constraints, override style defaults";
  if (mode === "balanced") return "BALANCED — strong guidance, blend with style recipe";
  return "LOOSE — soft inspiration only";
}

// Legacy strength label (used when no mode is specified)
function strengthLabel(s: number): string {
  if (s >= 71) return "STRICT — override style defaults if needed";
  if (s >= 31) return "NOTICEABLE — visibly influence, balance with style recipe";
  return "LOOSE — subtle inspiration only";
}

// ── Per-target line builders ──────────────────────────────────────────────────

function moodLine(mode: ReferenceMode, mood: string): string {
  if (mode === "strict")   return `• MOOD — must feel exactly: ${mood}`;
  if (mode === "balanced") return `• Mood: draw strongly from "${mood}"`;
  return `• Loose mood inspiration: ${mood}`;
}

function colorLines(mode: ReferenceMode, palette: PaletteColor[], analysis?: ReferenceAnalysis | null): string[] {
  const swatches = palette.map((p) => `${p.hex}(${p.role})`).join(", ");
  const dominant = palette[0]?.hex;
  const accent   = palette.find((p) => p.role === "accent")?.hex ?? palette.find((p) => p.role === "highlight")?.hex ?? palette[1]?.hex;
  const body     = palette.find((p) => p.role === "highlight")?.hex ?? palette[2]?.hex;
  const visionPalette = analysis?.palette?.join(", ");

  if (mode === "strict") {
    const lines = [`• COLOR PALETTE — use ONLY these colors, no exceptions:`];
    lines.push(`  Swatches: ${swatches}`);
    if (dominant) lines.push(`  Background / dominant field MUST be: ${dominant}`);
    if (accent)   lines.push(`  Accent / title fill MUST be: ${accent}`);
    if (body)     lines.push(`  Body / secondary fill MUST be: ${body}`);
    lines.push(`  Do NOT introduce any color outside this palette.`);
    if (visionPalette) lines.push(`  Vision-confirmed: ${visionPalette}`);
    return lines;
  }

  if (mode === "balanced") {
    const lines = [`• Color palette: ${swatches}`];
    if (dominant) lines.push(`  → Let ${dominant} dominate the atmosphere and primary fills.`);
    if (visionPalette) lines.push(`  Vision palette: ${visionPalette}`);
    return lines;
  }

  return [`• Color inspiration: ${palette.slice(0, 3).map((p) => p.hex).join(", ")}`];
}

function compositionLines(mode: ReferenceMode, composition: string, purpose: string): string[] {
  if (mode === "strict") {
    return [
      `• COMPOSITION — follow this exact spatial structure:`,
      `  "${composition}"`,
      `  Maintain spatial relationships and proportional layout. Do not significantly alter.`,
      purpose === "image" ? `  Leave negative space in matching areas of the frame.` : `  Mirror this hierarchy in layer placement and text positioning.`,
    ].filter(Boolean) as string[];
  }
  if (mode === "balanced") {
    return [
      `• Composition reference: ${composition}`,
      purpose !== "image" ? `  → Mirror this spatial hierarchy and negative-space distribution.` : `  → Match the negative space distribution.`,
    ].filter(Boolean) as string[];
  }
  return [`• Compositional inspiration: ${composition}`];
}

function typographyLine(mode: ReferenceMode, typographyStyle: string): string {
  if (mode === "strict")   return `• TYPOGRAPHY — match this treatment exactly: ${typographyStyle}. Do NOT reproduce the literal words.`;
  if (mode === "balanced") return `• Typography influence: ${typographyStyle}. Copy visual treatment only.`;
  return `• Type inspiration: ${typographyStyle}`;
}

function textureLine(mode: ReferenceMode, texture: string): string {
  if (mode === "strict")   return `• TEXTURE — must match: ${texture}`;
  if (mode === "balanced") return `• Texture influence: ${texture}`;
  return `• Texture inspiration: ${texture}`;
}

function lightingLine(mode: ReferenceMode, lighting: string): string {
  if (mode === "strict")   return `• LIGHTING — preserve exactly: ${lighting}`;
  if (mode === "balanced") return `• Lighting influence: ${lighting}`;
  return `• Lighting inspiration: ${lighting}`;
}

function backgroundLine(mode: ReferenceMode, analysis: ReferenceAnalysis, purpose: string): string[] {
  const lines = [`• Background treatment: ${analysis.shapes}. Surface: ${analysis.texture}.`];
  if (purpose === "image") {
    lines.push(
      mode === "strict"
        ? `  Generate a background that matches this treatment exactly — do NOT copy subject matter.`
        : `  Generate a background inspired by this abstract treatment.`
    );
  }
  return lines;
}

// ── Single reference section ──────────────────────────────────────────────────

function buildSingleImageSection(
  img: RefImageCtx,
  index: number,
  purpose: "image" | "layout" | "brief" | "typography",
): string {
  const { mode, role, targets, palette, analysis } = img;
  const activeTargets = Object.entries(targets).filter(([, v]) => v).map(([k]) => k);
  if (activeTargets.length === 0 && !analysis?.visualSummary) return "";

  const roleLabel = role.toUpperCase();
  const lines: string[] = [
    `\n[REFERENCE ${index + 1}: ${roleLabel} — ${modeLabel(mode)}]`,
  ];

  if (analysis?.visualSummary) {
    lines.push(`Visual: "${analysis.visualSummary}"`);
  }

  if (targets.mood && analysis?.mood)                           lines.push(moodLine(mode, analysis.mood));
  if (targets.color && palette && palette.length > 0)          lines.push(...colorLines(mode, palette, analysis));
  if (targets.backgroundStyle && analysis)                     lines.push(...backgroundLine(mode, analysis, purpose));
  if (targets.layout && analysis?.composition)                 lines.push(...compositionLines(mode, analysis.composition, purpose));
  if (targets.typography && analysis?.typographyStyle)         lines.push(typographyLine(mode, analysis.typographyStyle));
  if (targets.texture && analysis?.texture)                    lines.push(textureLine(mode, analysis.texture));
  if (targets.lighting && analysis?.lighting)                  lines.push(lightingLine(mode, analysis.lighting));

  return lines.join("\n");
}

// ── Multi-reference section ───────────────────────────────────────────────────

function buildMultiRefSection(
  ref: EnrichedRefCtx,
  purpose: "image" | "layout" | "brief" | "typography",
): string {
  const images = [...(ref.references ?? [])].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  const sections = images
    .map((img, i) => buildSingleImageSection(img, i, purpose))
    .filter(Boolean);

  if (sections.length === 0 && !ref.globalInstruction?.trim()) return "";

  const header = `\nREFERENCE GUIDANCE — ${images.length} image${images.length > 1 ? "s" : ""}:`;
  const body = sections.join("\n");
  const instruction = ref.globalInstruction?.trim()
    ? `\nGlobal instruction: ${ref.globalInstruction.trim()}`
    : "";

  return [header, body, instruction].filter(Boolean).join("\n");
}

// ── Legacy single-ref section (backward compat) ───────────────────────────────

function buildLegacySection(
  ref: EnrichedRefCtx,
  purpose: "image" | "layout" | "brief" | "typography",
): string {
  const { strength, targets, palette, analysis, instruction } = ref;
  const activeTargets = Object.entries(targets).filter(([, v]) => v).map(([k]) => k);
  if (activeTargets.length === 0 && !instruction?.trim()) return "";

  const label = strengthLabel(strength);
  const lines: string[] = [`\nREFERENCE IMAGE GUIDANCE — strength ${strength}/100 — ${label}:`];

  if (analysis?.visualSummary) lines.push(`Visual reference: "${analysis.visualSummary}"`);

  if (targets.mood && analysis?.mood) {
    lines.push(`Mood to capture: ${analysis.mood}`);
  }

  if (targets.color && palette && palette.length > 0) {
    const swatches = palette.map((p) => `${p.hex}(${p.role})`).join(", ");
    const dominant = palette[0]?.hex;
    const accent   = palette.find((p) => p.role === "accent")?.hex ?? palette.find((p) => p.role === "highlight")?.hex ?? palette[1]?.hex;
    const body     = palette.find((p) => p.role === "highlight")?.hex ?? palette[2]?.hex;

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

    if (analysis?.palette?.length) {
      lines.push(`  Vision-confirmed palette: ${analysis.palette.join(", ")}`);
    }
  }

  if (targets.backgroundStyle && analysis) {
    lines.push(`Background treatment: ${analysis.shapes}. Surface: ${analysis.texture}.`);
    if (purpose === "image") {
      lines.push(`Generate a background that matches this abstract treatment — do NOT copy subject matter.`);
    }
  }

  if (targets.layout && analysis?.composition) {
    lines.push(`Spatial composition: ${analysis.composition}`);
    if (purpose === "layout" || purpose === "brief") lines.push(`  → Mirror this spatial hierarchy and negative-space distribution.`);
    if (purpose === "image") lines.push(`  → Leave negative space in matching areas of the frame.`);
  }

  if (targets.typography && analysis?.typographyStyle) {
    lines.push(`Typography style reference: ${analysis.typographyStyle}`);
    lines.push(`  → Copy the visual treatment only — do NOT reproduce the actual words.`);
  }

  if (targets.texture && analysis?.texture) lines.push(`Texture / material feel: ${analysis.texture}`);
  if (targets.lighting && analysis?.lighting) lines.push(`Lighting atmosphere: ${analysis.lighting}`);
  if (instruction?.trim()) lines.push(`User instruction: ${instruction.trim()}`);

  return lines.join("\n");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Builds a structured reference section for injection into any AI prompt.
 * Automatically selects multi-ref or legacy path based on ctx shape.
 */
export function buildReferenceSection(
  ref: EnrichedRefCtx,
  purpose: "image" | "layout" | "brief" | "typography",
): string {
  if (ref.references && ref.references.length > 0) {
    return buildMultiRefSection(ref, purpose);
  }
  return buildLegacySection(ref, purpose);
}
