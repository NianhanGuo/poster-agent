import { NextRequest, NextResponse } from "next/server";
import { mockGradientDataUrl } from "@/lib/mockGradient";
import type { DesignBrief } from "@/types/poster";
import {
  buildReferenceSection,
  buildImageConstraintPrefix,
  buildFluxStyleBlock,
  isHardConstraintMode,
  ROLE_ORDER,
} from "@/lib/referencePrompt";
import type { EnrichedRefCtx } from "@/lib/referencePrompt";

// ─── Flux image-size picker ────────────────────────────────────────────────────

type FluxImageSize =
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9"
  | { width: number; height: number };

function pickFluxSize(width: number, height: number): FluxImageSize {
  const maxDim = 1440;
  const scale  = Math.min(1, maxDim / Math.max(width, height));
  const w      = Math.round(width  * scale);
  const h      = Math.round(height * scale);
  const snap   = (n: number) => Math.round(n / 32) * 32;
  return { width: snap(w), height: snap(h) };
}

// ─── Graphic quality suffix ───────────────────────────────────────────────────

const GRAPHIC_QUALITY_SUFFIX =
  "Graphic design aesthetic. Painterly illustration quality. Screen-print color relationships. Avoid stock photography feel, avoid AI artifact look. Strong silhouettes, decisive color zones, no muddy midtones.";

const RECIPE_STYLE_DIRECTION: Record<string, string> = {
  "cinematic-rain":    "Woodblock print abstraction. Bold black ink marks. Rain rendered as graphic lines not realism. East Asian ink wash meets Soviet constructivist geometry.",
  "cinematic_rain":    "Woodblock print abstraction. Bold black ink marks. Rain rendered as graphic lines not realism. East Asian ink wash meets Soviet constructivist geometry.",
  "gallery-minimal":   "Rothko color field painting. Pure color zones, soft luminous edges. No recognizable objects — pure abstract color relationships. Museum-quality stillness.",
  "gallery_minimal":   "Rothko color field painting. Pure color zones, soft luminous edges. No recognizable objects — pure abstract color relationships. Museum-quality stillness.",
  "brutalist-wall":    "Soviet constructivist poster aesthetic. Flat color planes, bold diagonal geometry, stark industrial materials. Rodchenko, El Lissitzky influence.",
  "brutalist_wall":    "Soviet constructivist poster aesthetic. Flat color planes, bold diagonal geometry, stark industrial materials. Rodchenko, El Lissitzky influence.",
  "surreal-film":      "Double exposure film photography technique. Two images occupying the same space. Dreamlike layering, organic shapes dissolving into each other.",
  "surreal_film":      "Double exposure film photography technique. Two images occupying the same space. Dreamlike layering, organic shapes dissolving into each other.",
  "blur-field":        "Pure color abstraction. Soft bokeh light fields, no hard edges, no recognizable forms. Color relationships only — Turrell light installation aesthetic.",
  "diffuse_blur":      "Pure color abstraction. Soft bokeh light fields, no hard edges, no recognizable forms. Color relationships only — Turrell light installation aesthetic.",
  "archive-museum":    "Archival photography aesthetic. Aged photographic print quality, sepia or faded color, documentary gravitas. Walker Evans, August Sander influence.",
  "archive_museum":    "Archival photography aesthetic. Aged photographic print quality, sepia or faded color, documentary gravitas. Walker Evans, August Sander influence.",
  "experimental-type": "Layered risograph print aesthetic. Misregistered color separation, halftone dot patterns, zine production texture. Neon accents on dark grounds.",
  "experimental_type": "Layered risograph print aesthetic. Misregistered color separation, halftone dot patterns, zine production texture. Neon accents on dark grounds.",
  "soft-editorial":    "Editorial fashion photography aesthetic. Soft diffused light, muted pastel palette, elegant restraint. Céline or Bottega Veneta campaign quality.",
  "soft_editorial":    "Editorial fashion photography aesthetic. Soft diffused light, muted pastel palette, elegant restraint. Céline or Bottega Veneta campaign quality.",
};

// ─── Subject visual term expansion ───────────────────────────────────────────

const SUBJECT_VISUAL_TERMS: Record<string, string[]> = {
  rain:      ["rain", "rainfall", "raindrops", "wet", "mist", "drizzle", "water streaks", "precipitation", "rainy atmosphere"],
  water:     ["water", "ocean", "sea", "liquid", "aquatic", "waves", "fluid", "ripple"],
  snow:      ["snow", "snowfall", "blizzard", "frost", "icy", "winter", "flurry"],
  fire:      ["fire", "flame", "ember", "heat", "combustion", "burning"],
  forest:    ["forest", "tree", "foliage", "woodland", "canopy", "leaf"],
  night:     ["night", "dark", "moon", "star", "nocturnal", "midnight"],
  light:     ["light", "glow", "luminosity", "ray", "radiance", "beam"],
  fog:       ["fog", "mist", "haze", "murky", "obscured", "atmospheric"],
  city:      ["city", "urban", "building", "architecture", "street", "skyline"],
  sea:       ["sea", "ocean", "wave", "shoreline", "nautical", "maritime"],
  flower:    ["flower", "bloom", "petal", "flora", "blossom", "botanical"],
  abstract:  ["abstract", "geometric", "shape", "form", "pattern", "texture"],
};

/**
 * Expands a user subject prompt into specific visual terms for Flux.
 * Returns the terms if subject matches known keywords, otherwise the literal subject.
 */
function expandSubjectToVisualTerms(subject: string): string {
  const lower = subject.toLowerCase();
  const matched: string[] = [];

  for (const [key, terms] of Object.entries(SUBJECT_VISUAL_TERMS)) {
    if (lower.includes(key)) {
      matched.push(...terms);
    }
  }

  if (matched.length > 0) {
    // Deduplicate and return unique terms
    return [...new Set(matched)].join(", ");
  }

  // Unknown subject — use the literal words
  return subject;
}

/**
 * Validates that the final Flux prompt contains the user's subject.
 * Returns { valid: boolean; missingTerms: string[] }
 */
function validateSubjectInPrompt(
  finalPrompt: string,
  userSubject: string,
): { valid: boolean; missingTerms: string[] } {
  if (!userSubject.trim()) return { valid: true, missingTerms: [] };

  const lowerPrompt = finalPrompt.toLowerCase();
  const lowerSubject = userSubject.toLowerCase();

  // Check literal subject words
  const subjectWords = lowerSubject.split(/\s+/).filter((w) => w.length > 2);
  const literalPresent = subjectWords.some((w) => lowerPrompt.includes(w));
  if (literalPresent) return { valid: true, missingTerms: [] };

  // Check expanded terms
  const expandedTerms = expandSubjectToVisualTerms(lowerSubject).split(", ");
  const presentTerms = expandedTerms.filter((t) => lowerPrompt.includes(t.toLowerCase()));
  if (presentTerms.length > 0) return { valid: true, missingTerms: [] };

  return {
    valid: false,
    missingTerms: expandedTerms.slice(0, 5),
  };
}

// ─── Reference-mode Flux prompt builder ──────────────────────────────────────

/**
 * Builds the complete Flux prompt for reference mode.
 * Structure:
 *   SUBJECT / CONTENT    — what must be in the image
 *   REFERENCE STYLE      — how it should look (from analysis)
 *   HARD REQUIREMENTS    — explicit rules combining both
 */
function buildReferenceFluxPrompt(
  userSubjectPrompt: string,
  fluxPromptFromLayout: string | undefined,
  refCtx: EnrichedRefCtx,
  spacePlacement: string,
): string {
  const refs = refCtx.references ?? [];
  const sorted = [...refs].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  const primary = sorted[0];
  const a = primary?.analysis;
  const p = primary?.palette ?? [];

  const sections: string[] = [];

  // ── SECTION 1: SUBJECT / CONTENT ─────────────────────────────────────────
  if (userSubjectPrompt.trim()) {
    const visualTerms = expandSubjectToVisualTerms(userSubjectPrompt);
    const subjectSection = [
      `SUBJECT / CONTENT:`,
      `A poster about: "${userSubjectPrompt}".`,
      `The subject MUST be visually present in the final image.`,
      `Required visual elements: ${visualTerms}.`,
      `Do NOT replace "${userSubjectPrompt}" with unrelated scenery.`,
    ].join("\n");
    sections.push(subjectSection);
  }

  // ── SECTION 2: REFERENCE STYLE TO FOLLOW ─────────────────────────────────
  const styleLines = [`REFERENCE STYLE TO FOLLOW:`];

  if (a?.styleClass)    styleLines.push(`  Poster genre: ${a.styleClass}`);
  if (a?.visualSummary) styleLines.push(`  Overall aesthetic: "${a.visualSummary}"`);
  if (a?.mood)          styleLines.push(`  Mood: ${a.mood}`);
  if (a?.brightness)    styleLines.push(`  Brightness: ${a.brightness}`);
  if (a?.contrast)      styleLines.push(`  Contrast: ${a.contrast}`);
  if (a?.blurMap)       styleLines.push(`  Blur/depth treatment: ${a.blurMap}`);
  if (a?.texture)       styleLines.push(`  Surface texture: ${a.texture}`);
  if (a?.lighting)      styleLines.push(`  Lighting: ${a.lighting}`);
  if (a?.shapes)        styleLines.push(`  Geometric structure: ${a.shapes}`);

  if (p.length > 0) {
    styleLines.push(`  Color palette (mandatory — use ONLY these colors):`);
    p.forEach((c) => styleLines.push(`    ${c.hex}  (${c.role})`));
  } else if (a?.palette?.length) {
    styleLines.push(`  Colors: ${a.palette.join(", ")}`);
  }

  // The GPT-4o fluxPrompt as additional atmospheric context
  if (fluxPromptFromLayout?.trim() && fluxPromptFromLayout.length > 10) {
    styleLines.push(`  Atmospheric context (from layout): "${fluxPromptFromLayout}"`);
  }

  sections.push(styleLines.join("\n"));

  // ── SECTION 3: HARD VISUAL REQUIREMENTS ──────────────────────────────────
  const reqLines = [`HARD VISUAL REQUIREMENTS:`];

  // Subject requirements
  if (userSubjectPrompt.trim()) {
    reqLines.push(`- "${userSubjectPrompt}" must be visually present and recognizable`);
    reqLines.push(`- Do NOT ignore or replace "${userSubjectPrompt}" with unrelated imagery`);
  }

  // Color requirements
  if (p.length > 0) {
    reqLines.push(`- Use ONLY the reference palette: ${p.slice(0, 4).map((c) => c.hex).join(", ")}`);
    reqLines.push(`- Do not introduce colors outside this palette`);
  }
  if (a?.brightness)  reqLines.push(`- Brightness must be "${a.brightness}" — ${a.brightness === "dark" ? "no bright backgrounds" : a.brightness === "light" ? "no dark backgrounds" : "balanced mid-tones"}`);
  if (a?.contrast)    reqLines.push(`- Contrast must be "${a.contrast}"`);

  // Rules from analysis
  if (a?.rulesToFollow && a.rulesToFollow.length > 0) {
    a.rulesToFollow.forEach((r) => reqLines.push(`- ${r}`));
  }

  // Forbidden
  reqLines.push(``);
  reqLines.push(`FORBIDDEN:`);
  reqLines.push(`- Do NOT use any preset recipe style (cinematic, editorial, brutalist, etc.)`);
  reqLines.push(`- Do NOT ignore the user's subject prompt`);
  if (a?.forbiddenDrift && a.forbiddenDrift.length > 0) {
    a.forbiddenDrift.forEach((f) => reqLines.push(`- ${f}`));
  }

  // Standard closing
  reqLines.push(``);
  reqLines.push(`No text, no letters, no typography, no words.`);
  reqLines.push(`Pure atmospheric background only.`);
  reqLines.push(`Leave intentional empty negative space in the ${spacePlacement} for typography overlay.`);

  sections.push(reqLines.join("\n"));

  // Graphic quality
  sections.push(GRAPHIC_QUALITY_SUFFIX);

  return sections.join("\n\n");
}

// ─── Normal-mode prompt builder ───────────────────────────────────────────────

function negativeSpacePlacement(brief?: DesignBrief): string {
  if (!brief) return "center";
  if (brief.composition === "edge-heavy") return "center";
  if (brief.composition === "asymmetric") return "left or right third";
  return "upper third";
}

function buildImagePrompt(
  basePrompt: string,
  brief?: DesignBrief,
  reference?: EnrichedRefCtx,
): string {
  const hardMode = reference ? isHardConstraintMode(reference) : false;
  const spacePlacement = negativeSpacePlacement(brief);

  const closingSuffix = [
    "No text, no letters, no typography, no words.",
    "Pure atmospheric background only.",
    `Intentional empty negative space in the ${spacePlacement} for typography overlay.`,
  ].join(" ");

  if (hardMode && reference) {
    const constraintBlock = buildImageConstraintPrefix(reference, basePrompt);
    const parts: string[] = [];
    if (constraintBlock) parts.push(constraintBlock);
    if (brief) {
      switch (brief.composition) {
        case "asymmetric":  parts.push("Asymmetric, off-center composition."); break;
        case "edge-heavy":  parts.push("Elements at canvas edges, large central void."); break;
        case "grid":        parts.push("Structured grid composition."); break;
      }
      if (brief.negativeSpace === "high") {
        parts.push("Extensive negative space. Subject occupies at most 30% of frame.");
      }
    }
    parts.push(closingSuffix);
    return parts.join(" ");
  }

  const parts: string[] = [basePrompt];
  if (brief) {
    parts.push(`Mood: ${brief.mood}.`);
    switch (brief.composition) {
      case "asymmetric":    parts.push("Asymmetric, off-center composition."); break;
      case "edge-heavy":    parts.push("Elements at canvas edges, large central void."); break;
      case "grid":          parts.push("Structured grid composition."); break;
    }
    switch (brief.imageStrategy) {
      case "abstract":      parts.push("Abstract, non-representational imagery."); break;
      case "texture":       parts.push("Textural, surface-focused. Close-up material detail."); break;
      case "empty":         parts.push("Extremely minimal. Near-empty frame, single subject."); break;
    }
    switch (brief.colorStrategy) {
      case "monochrome":    parts.push("Monochromatic palette only."); break;
      case "duotone":       parts.push("Duotone color treatment — two complementary tones."); break;
      case "muted":         parts.push("Muted, desaturated palette."); break;
      case "high-contrast": parts.push("High contrast, strong darks and lights."); break;
    }
    if (brief.negativeSpace === "high") {
      parts.push("Extensive negative space. Minimalist. Subject occupies at most 30% of frame.");
    }
  }
  if (reference) {
    const refSection = buildReferenceSection(reference, "image");
    if (refSection) parts.push(refSection);
  }
  parts.push(
    closingSuffix,
    "Photographic quality or painterly illustration — no AI artifacts.",
  );
  return parts.join(" ");
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // userPrompt = the original user-typed concept (e.g. "rain")
  // prompt     = the GPT-4o-generated fluxPrompt / imagePrompt (atmospheric description)
  // fluxPrompt = alias of prompt in some call paths
  const {
    userPrompt,
    prompt,
    fluxPrompt,
    styleRecipe,
    style,
    styleSource,
    width,
    height,
    brief,
    reference,
  } = await req.json();

  const recipe    = styleRecipe ?? style ?? "cinematic-rain";
  const refCtx    = reference as EnrichedRefCtx | undefined;
  const hardMode  = refCtx ? isHardConstraintMode(refCtx) : false;

  // Reference mode: styleSource === "reference" OR references array exists in hard mode
  const isReferenceMode =
    styleSource === "reference" ||
    (hardMode && !!refCtx?.references && refCtx.references.length > 0);

  if (!process.env.FAL_KEY) {
    const gradientUrl = mockGradientDataUrl(recipe, width ?? 800, height ?? 1200);
    return NextResponse.json({ url: gradientUrl, demo: true });
  }

  const spacePlacement = negativeSpacePlacement(brief as DesignBrief | undefined);

  // Recipe style direction is SUPPRESSED in reference mode
  const recipeStyleDir = isReferenceMode ? "" : (RECIPE_STYLE_DIRECTION[recipe] ?? "");

  const closingSuffix = [
    "No text, no letters, no typography, no words.",
    "Pure atmospheric background only.",
    `Intentional empty negative space in the ${spacePlacement} for typography overlay.`,
  ].join(" ");

  let finalPrompt: string;

  if (isReferenceMode && refCtx) {
    // ── REFERENCE MODE: explicit 3-section prompt ─────────────────────────
    // userPrompt is the original user concept ("rain")
    // prompt/fluxPrompt is GPT-4o's atmospheric description (may or may not contain subject)
    const subjectForFlux = (userPrompt ?? "").trim();
    const atmosphericFromLayout = (fluxPrompt ?? prompt ?? "").trim();

    finalPrompt = buildReferenceFluxPrompt(
      subjectForFlux,
      atmosphericFromLayout,
      refCtx,
      spacePlacement,
    );

    // ── VALIDATION: check subject appears in final prompt ─────────────────
    if (subjectForFlux) {
      const validation = validateSubjectInPrompt(finalPrompt, subjectForFlux);
      if (!validation.valid) {
        console.error("[image/route] ⚠ SUBJECT VALIDATION FAILED");
        console.error("[image/route] Subject:", subjectForFlux);
        console.error("[image/route] Missing terms:", validation.missingTerms);
        // Prepend an emergency subject injection — this must not silently fail
        finalPrompt =
          `CRITICAL: The subject "${subjectForFlux}" (${expandSubjectToVisualTerms(subjectForFlux)}) MUST be in this image.\n\n` +
          finalPrompt;
      }
    }
  } else if (fluxPrompt) {
    // ── PRESET MODE with layout fluxPrompt ───────────────────────────────
    finalPrompt = [fluxPrompt, recipeStyleDir, closingSuffix, GRAPHIC_QUALITY_SUFFIX]
      .filter(Boolean)
      .join(" ");
  } else {
    // ── PRESET MODE without fluxPrompt ───────────────────────────────────
    const basePrompt = buildImagePrompt(
      prompt ?? "",
      brief as DesignBrief | undefined,
      refCtx,
    );
    finalPrompt = [basePrompt, recipeStyleDir, GRAPHIC_QUALITY_SUFFIX]
      .filter(Boolean)
      .join(" ");
  }

  // ── ALWAYS LOG ── visible in Next.js server stdout ────────────────────────
  console.log("[image/route] ══════ IMAGE GENERATION DEBUG ══════");
  console.log("[image/route] generationMode:    ", isReferenceMode ? "REFERENCE" : "PRESET");
  console.log("[image/route] styleSource:       ", styleSource ?? "(not set)");
  console.log("[image/route] userPrompt:        ", userPrompt ?? "(not provided — subject may be absent!)");
  console.log("[image/route] fluxPrompt from layout:", (fluxPrompt ?? prompt ?? "").slice(0, 120));
  console.log("[image/route] recipe:            ", isReferenceMode ? "(SUPPRESSED)" : recipe);
  console.log("[image/route] recipeStyleDir:    ", isReferenceMode ? "(SUPPRESSED)" : (recipeStyleDir.slice(0, 60) || "(none)"));
  console.log("[image/route] reference.count:   ", refCtx?.references?.length ?? 0);
  console.log("[image/route] analysis exists:   ", refCtx?.references?.some((r: {analysis?: unknown}) => r.analysis != null) ?? false);
  console.log("[image/route] Final prompt (" + finalPrompt.length + " chars):");
  console.log(finalPrompt);
  console.log("[image/route] ═════════════════════════════════════");

  try {
    const { fal } = await import("@fal-ai/client");
    fal.config({ credentials: process.env.FAL_KEY });

    const imageSize = pickFluxSize(width ?? 800, height ?? 1200);

    const result = await fal.subscribe("fal-ai/flux-pro/v1.1", {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input: {
        prompt: finalPrompt,
        image_size: imageSize,
        num_inference_steps: 35,
        guidance_scale: 4.0,
        num_images: 1,
        safety_tolerance: "5",
        output_format: "jpeg",
        output_quality: 95,
      } as any,
    });

    const imageUrl = (result.data as { images: { url: string }[] }).images?.[0]?.url;
    if (!imageUrl) throw new Error("No image returned from Flux");

    return NextResponse.json({ url: imageUrl, demo: false, promptPreview: finalPrompt });
  } catch (err) {
    console.error("[image/route] Flux error:", err);
    const gradientUrl = mockGradientDataUrl(recipe, width ?? 800, height ?? 1200);
    return NextResponse.json({ url: gradientUrl, demo: true });
  }
}
