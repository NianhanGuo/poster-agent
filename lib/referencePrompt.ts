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
    const lines = [`• COLOR PALETTE — ~95% fidelity required. Use ONLY these colors, no exceptions:`];
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
      `• COMPOSITION — ~90% spatial fidelity required. Follow this exact zone structure:`,
      `  "${composition}"`,
      `  Reproduce zone occupancy and negative-space distribution closely. Minor proportional adjustments only.`,
      purpose === "image" ? `  Leave negative space in the same zones of the frame as the reference.` : `  Mirror this zone hierarchy in layer placement and text positioning.`,
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
  if (mode === "strict") {
    const lines = [
      `• SHAPES/GEOMETRY — ~80% shape primitive fidelity required:`,
      `  "${analysis.shapes}"`,
      `  Reproduce these specific shape primitives (circles, blobs, gradient fields) at similar scale and position.`,
    ];
    if (analysis.blurMap) {
      lines.push(`• BLUR MAP — match depth and blur distribution zone by zone:`);
      lines.push(`  "${analysis.blurMap}"`);
    }
    if (analysis.texture) lines.push(`  Surface: ${analysis.texture}.`);
    if (purpose === "image") {
      lines.push(`  Generate a background matching this shape and blur structure exactly — do NOT copy subject matter.`);
    }
    return lines;
  }
  const lines = [`• Background treatment: ${analysis.shapes}. Surface: ${analysis.texture}.`];
  if (analysis.blurMap) lines.push(`  Blur distribution: ${analysis.blurMap}`);
  if (purpose === "image") {
    lines.push(`  Generate a background inspired by this abstract treatment.`);
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

// ── Reference-as-style-source ─────────────────────────────────────────────────

/**
 * Builds a COMPLETE style specification from reference image analysis.
 * Used when styleSource === "reference" — this REPLACES the preset recipe entirely.
 *
 * The output covers all 8 dimensions needed by GPT-4o to generate without a recipe:
 * typography, layout structure, image treatment, color palette, composition,
 * mood, hierarchy, and poster genre signals.
 */
export function buildReferenceStyleInstruction(references: RefImageCtx[]): string {
  const sorted = [...references].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  const primary = sorted.find((r) => r.role === "primary") ?? sorted[0];

  if (!primary) return "";

  const a = primary.analysis;
  const p = primary.palette ?? [];

  const lines: string[] = [
    "═══════════════════════════════════════════════════════",
    "REFERENCE STYLE TO FOLLOW — NO PRESET RECIPE ACTIVE",
    "ALL design decisions must be derived from this analysis.",
    "CRITICAL: The font pairing table in the system prompt is INACTIVE.",
    "Choose fonts that match the reference typography, not any named recipe.",
    "═══════════════════════════════════════════════════════",
  ];

  // ── Genre + overall aesthetic ──────────────────────────────────────────────
  if (a?.styleClass)    lines.push(`Poster genre:     ${a.styleClass}`);
  if (a?.visualSummary) lines.push(`Overall aesthetic: "${a.visualSummary}"`);
  if (a?.mood)          lines.push(`Mood:             ${a.mood}`);
  if (a?.brightness)    lines.push(`Brightness:       ${a.brightness}`);
  if (a?.contrast)      lines.push(`Contrast:         ${a.contrast}`);

  // ── Color palette (mandatory) ──────────────────────────────────────────────
  if (p.length > 0) {
    lines.push("");
    lines.push("COLOR PALETTE — use only these colors, no exceptions:");
    p.forEach((c) => lines.push(`  ${c.hex}  (${c.role})`));

    const dominant = p[0]?.hex;
    const accent   = p.find((c) => c.role === "accent")?.hex
                  ?? p.find((c) => c.role === "highlight")?.hex
                  ?? p[1]?.hex;
    const body     = p.find((c) => c.role === "highlight")?.hex ?? p[2]?.hex;
    if (dominant) lines.push(`  → solidBackground / dominant field: ${dominant}`);
    if (accent)   lines.push(`  → accent / title fill:              ${accent}`);
    if (body)     lines.push(`  → body / secondary fill:            ${body}`);
    if (a?.palette?.length) lines.push(`  Vision-confirmed: ${a.palette.join(", ")}`);
  }

  // ── Layout / composition ───────────────────────────────────────────────────
  if (a?.composition) {
    lines.push("");
    lines.push("LAYOUT STRUCTURE — mirror this spatial hierarchy exactly:");
    lines.push(`  "${a.composition}"`);
  }

  // ── Typography system ──────────────────────────────────────────────────────
  lines.push("");
  if (a?.typographyExtract) {
    const te = a.typographyExtract;
    lines.push("TYPOGRAPHY — match these parameters:");
    lines.push(`  Hierarchy:   ${te.hierarchy}   (how text blocks relate in scale)`);
    lines.push(`  Alignment:   ${te.alignment}`);
    lines.push(`  Orientation: ${te.orientation}`);
    lines.push(`  Scale:       ${te.scale}`);
    lines.push(`  Spacing:     ${te.spacing}`);
    lines.push(`  Density:     ${te.density}`);
    lines.push(`  Positioning: ${te.positioning}`);
    lines.push(`  Style:       ${te.style}  → choose fonts that embody this aesthetic`);
    lines.push(`  Rotation:    ${te.rotation}`);
    if (a.typographyStyle && a.typographyStyle !== "no text visible") {
      lines.push(`  Raw description: "${a.typographyStyle}"`);
    }
  } else if (a?.typographyStyle && a.typographyStyle !== "no text visible") {
    lines.push("TYPOGRAPHY:");
    lines.push(`  "${a.typographyStyle}"`);
  } else {
    lines.push("TYPOGRAPHY: no text detected in reference — design clean typographic hierarchy");
  }

  // ── Image treatment ────────────────────────────────────────────────────────
  lines.push("");
  lines.push("IMAGE TREATMENT:");
  if (a?.shapes)  lines.push(`  Geometry/shapes: "${a.shapes}"`);
  if (a?.blurMap) lines.push(`  Blur map:        "${a.blurMap}"`);
  if (a?.texture) lines.push(`  Surface texture: "${a.texture}"`);
  if (a?.lighting)lines.push(`  Lighting:        "${a.lighting}"`);

  // ── Secondary / accent references ─────────────────────────────────────────
  if (sorted.length > 1) {
    lines.push("");
    lines.push("SUPPLEMENTARY REFERENCES:");
    for (let i = 1; i < sorted.length; i++) {
      const ref = sorted[i];
      const ra = ref.analysis;
      const rp = ref.palette ?? [];
      lines.push(`  [${ref.role.toUpperCase()}]:`);
      if (ra?.visualSummary) lines.push(`    Visual: "${ra.visualSummary}"`);
      if (ra?.mood)          lines.push(`    Mood: ${ra.mood}`);
      if (rp.length > 0)     lines.push(`    Accent colors: ${rp.slice(0, 3).map((c) => c.hex).join(", ")}`);
    }
  }

  // ── Affirmative rules extracted from reference ─────────────────────────────
  const rulesTo = a?.rulesToFollow ?? [];
  if (rulesTo.length > 0) {
    lines.push("");
    lines.push("RULES TO FOLLOW (extracted from reference — apply exactly):");
    rulesTo.forEach((r) => lines.push(`  ✓ ${r}`));
  }

  // ── Forbidden terms ────────────────────────────────────────────────────────
  const forbidden = a?.forbiddenDrift ?? [];
  if (forbidden.length > 0) {
    lines.push("");
    lines.push("RULES TO AVOID (must NEVER appear in output):");
    forbidden.forEach((f) => lines.push(`  ✗ ${f}`));
  }

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

// ── Hard constraint system (for image generation strict / strength ≥ 80) ──────

/** Returns true if any reference in the context is in strict mode or has strength ≥ 80. */
export function isHardConstraintMode(ref: EnrichedRefCtx): boolean {
  if (ref.references && ref.references.length > 0) {
    return ref.references.some((r) => r.mode === "strict" || r.strength >= 80);
  }
  return ref.strength >= 80;
}

function styleClassLabel(styleClass: string): string {
  switch (styleClass) {
    case "abstract-poster":   return "abstract poster / non-representational graphic design";
    case "blurred-gradient":  return "blurred gradient / soft-focus color field";
    case "geometric-graphic": return "geometric graphic design / flat shapes";
    case "photographic":      return "photographic";
    case "illustration":      return "illustration / painted";
    case "typographic":       return "typographic design";
    default:                  return styleClass;
  }
}

function styleClassForbiddenTypes(styleClass: string): string {
  switch (styleClass) {
    case "abstract-poster":
    case "blurred-gradient":
    case "geometric-graphic":
      return "a photograph, cinematic scene, realistic landscape, 3D render, or fantasy environment";
    case "photographic":
      return "an illustration, abstract design, or flat graphic";
    case "illustration":
      return "a photograph or 3D CGI render";
    default:
      return "a radically different medium or aesthetic";
  }
}

function isAbstractStyleClass(styleClass: string): boolean {
  return ["abstract-poster", "blurred-gradient", "geometric-graphic"].includes(styleClass);
}

function brightnessConstraint(brightness: "light" | "medium" | "dark"): string {
  if (brightness === "light") {
    return "light background, pastel tones, high luminosity — NO dark backgrounds, NO black, NO dark scenes";
  }
  if (brightness === "dark") {
    return "dark background, deep tones — NO bright backgrounds, NO white, NO overexposed look";
  }
  return "balanced mid-tones";
}

function contrastConstraint(contrast: "low" | "medium" | "high"): string {
  if (contrast === "low") {
    return "low contrast, soft tonal transitions — NO dramatic shadows, NO harsh highlights, NO deep blacks";
  }
  if (contrast === "high") {
    return "high contrast, strong tonal separation — clear darks vs lights";
  }
  return "moderate tonal range";
}

function hexBrightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function buildAutoForbidden(
  analysis: ReferenceAnalysis | null | undefined,
  palette: PaletteColor[],
): string[] {
  const terms: string[] = [];

  if (!analysis) {
    // Infer from palette brightness alone
    if (palette.length > 0) {
      const avg = palette.reduce((s, p) => s + hexBrightness(p.hex), 0) / palette.length;
      if (avg > 180) terms.push("dark background", "dark scene", "noir aesthetic", "deep shadows");
      else if (avg < 80) terms.push("white background", "bright overexposed look");
    }
    return terms;
  }

  if (analysis.brightness === "light") {
    terms.push("dark background", "dark scene", "noir aesthetic", "deep shadows", "black backdrop");
  } else if (analysis.brightness === "dark") {
    terms.push("white background", "bright background", "overexposed look", "bleached aesthetic");
  }

  if (analysis.contrast === "low") {
    terms.push("high contrast", "dramatic lighting", "strong directional shadows", "harsh highlights", "deep blacks and bright whites");
  } else if (analysis.contrast === "high") {
    terms.push("flat monotone wash", "soft pastel blur with no tonal range");
  }

  const abstractClasses = ["abstract-poster", "blurred-gradient", "geometric-graphic"];
  if (abstractClasses.includes(analysis.styleClass)) {
    terms.push(
      "realistic landscape or nature photography",
      "fantasy or sci-fi environment",
      "cinematic film composition",
      "sharp 3D rendering or CGI",
      "human figures or characters as focal point",
      "identifiable objects or representational scenes",
    );
  }

  if (analysis.styleClass === "blurred-gradient") {
    terms.push("sharp edges or crisp outlines", "photographic depth of field", "3D modeled surfaces");
  }

  // GPT-detected forbidden drift
  if (Array.isArray(analysis.forbiddenDrift) && analysis.forbiddenDrift.length > 0) {
    terms.push(...analysis.forbiddenDrift);
  }

  return [...new Set(terms)];
}

/**
 * Builds a hard constraint block for image generation.
 * Place this FIRST in the DALL-E prompt so it carries maximum weight.
 * Only called when isHardConstraintMode() returns true.
 *
 * @param ref      - enriched reference context
 * @param subject  - the user's concept/subject prompt (e.g. "water", "film poster")
 */
export function buildImageConstraintPrefix(ref: EnrichedRefCtx, subject: string): string {
  // Resolve the primary strict/high-strength reference
  let analysis: ReferenceAnalysis | null | undefined;
  let palette: PaletteColor[] = [];

  if (ref.references && ref.references.length > 0) {
    const sorted = [...ref.references].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
    const primary =
      sorted.find((r) => r.mode === "strict" || r.strength >= 80) ??
      sorted.find((r) => r.mode === "balanced") ??
      sorted[0];
    analysis = primary?.analysis;
    palette  = primary?.palette ?? [];
  } else {
    analysis = ref.analysis;
    palette  = ref.palette ?? [];
  }

  if (!analysis && palette.length === 0) return "";

  const lines: string[] = [
    `REFERENCE CONSTRAINTS — HARD OVERRIDE.`,
    `These are HARD VISUAL CONSTRAINTS, not inspiration. The output MUST preserve them exactly.`,
    `They override the subject prompt, style preset, and brief. Do not drift from them.`,
    ``,
  ];

  if (analysis?.styleClass) {
    lines.push(`STYLE: ${styleClassLabel(analysis.styleClass)}`);
    lines.push(`  NOT: ${styleClassForbiddenTypes(analysis.styleClass)}`);
  }

  if (analysis?.brightness) {
    lines.push(`BRIGHTNESS: ${analysis.brightness.toUpperCase()} — ${brightnessConstraint(analysis.brightness)}`);
  }

  if (analysis?.contrast) {
    lines.push(`CONTRAST: ${analysis.contrast.toUpperCase()} — ${contrastConstraint(analysis.contrast)}`);
  }

  if (palette.length > 0) {
    const swatches = palette.map((p) => `${p.hex}(${p.role})`).join(", ");
    lines.push(`MANDATORY PALETTE — DO NOT introduce new dominant colors outside this set:`);
    lines.push(`  ${swatches}`);
    if (analysis?.palette?.length) {
      lines.push(`  Vision-confirmed: ${analysis.palette.join(", ")}`);
    }
  }

  if (analysis?.mood)        lines.push(`MOOD: ${analysis.mood}`);
  if (analysis?.texture)     lines.push(`TEXTURE/SURFACE: ${analysis.texture}`);
  if (analysis?.shapes)      lines.push(`GEOMETRY/SHAPES (~80% fidelity): ${analysis.shapes}`);
  if (analysis?.blurMap)     lines.push(`BLUR MAP: ${analysis.blurMap}`);

  // Forbidden block
  const forbidden = buildAutoForbidden(analysis, palette);
  if (forbidden.length > 0) {
    lines.push(``);
    lines.push(`FORBIDDEN — output MUST NOT contain any of these:`);
    for (const f of forbidden) lines.push(`  - ${f}`);
  }

  // Subject abstraction — reframe the concept so it doesn't override the reference aesthetic
  const isAbstract = analysis?.styleClass ? isAbstractStyleClass(analysis.styleClass) : false;
  if (isAbstract && subject.trim()) {
    lines.push(``);
    lines.push(`SUBJECT INTERPRETATION:`);
    lines.push(`Interpret "${subject}" as an abstract graphic design concept — NOT a literal scene.`);
    lines.push(`Do NOT generate a realistic or photographic depiction of "${subject}".`);
    lines.push(`Instead: render it as abstract forms, blurred shapes, or graphic geometry in the palette above.`);
    lines.push(`This is a graphic design piece, not nature photography or a cinematic scene.`);
  }

  // Global instruction (highest priority user intent)
  const instruction = ref.globalInstruction?.trim() ?? ref.instruction?.trim();
  if (instruction) {
    lines.push(``);
    lines.push(`USER INSTRUCTION (highest priority): ${instruction}`);
  }

  return lines.join("\n");
}

/**
 * Returns auto-forbidden terms for a given reference context — used by the debug panel.
 */
export function getAutoForbiddenTerms(ref: EnrichedRefCtx): string[] {
  if (ref.references && ref.references.length > 0) {
    const sorted = [...ref.references].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
    const primary = sorted[0];
    return buildAutoForbidden(primary?.analysis, primary?.palette ?? []);
  }
  return buildAutoForbidden(ref.analysis, ref.palette ?? []);
}
