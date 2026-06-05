import { NextRequest, NextResponse } from "next/server";
import { mockGradientDataUrl } from "@/lib/mockGradient";
import type { DesignBrief } from "@/types/poster";
import {
  buildReferenceSection,
  buildImageConstraintPrefix,
  isHardConstraintMode,
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
  // Cap at 1440 on the long edge — Flux max
  const maxDim = 1440;
  const scale  = Math.min(1, maxDim / Math.max(width, height));
  const w      = Math.round(width  * scale);
  const h      = Math.round(height * scale);
  // Round to nearest multiple of 32 (Flux requirement)
  const snap   = (n: number) => Math.round(n / 32) * 32;
  return { width: snap(w), height: snap(h) };
}

// ─── Graphic quality suffix — appended to every Flux prompt ──────────────────

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

// ─── Negative-space placement hint from brief ─────────────────────────────────

function negativeSpacePlacement(brief?: DesignBrief): string {
  if (!brief) return "center";
  if (brief.composition === "edge-heavy") return "center";
  if (brief.composition === "asymmetric") return "left or right third";
  return "upper third";
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Normal path:   concept + brief directives + reference section + hard rules
 * Hard-constraint path: constraint block first (weights early tokens heavily)
 */
function buildImagePrompt(
  basePrompt: string,
  brief?: DesignBrief,
  reference?: EnrichedRefCtx,
): string {
  const hardMode    = reference ? isHardConstraintMode(reference) : false;
  const spacePlacement = negativeSpacePlacement(brief);

  // Shared closing suffix — always appended
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

  // Normal path
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
  const { prompt, fluxPrompt, styleRecipe, style, styleSource, width, height, brief, reference } = await req.json();
  const recipe = styleRecipe ?? style ?? "cinematic-rain";

  if (!process.env.FAL_KEY) {
    const gradientUrl = mockGradientDataUrl(recipe, width ?? 800, height ?? 1200);
    return NextResponse.json({ url: gradientUrl, demo: true });
  }

  const refCtx = reference as EnrichedRefCtx | undefined;
  const hardMode = refCtx ? isHardConstraintMode(refCtx) : false;

  // Reference mode is active when styleSource === "reference" OR when references exist in hard mode
  const isReferenceMode =
    styleSource === "reference" ||
    (hardMode && !!refCtx?.references && refCtx.references.length > 0);

  const spacePlacement = negativeSpacePlacement(brief as DesignBrief | undefined);
  const closingSuffix = [
    "No text, no letters, no typography, no words.",
    "Pure atmospheric background only.",
    `Intentional empty negative space in the ${spacePlacement} for typography overlay.`,
  ].join(" ");

  // CRITICAL: Recipe style direction is SUPPRESSED in reference mode.
  // The reference analysis must drive the image, not the preset aesthetic.
  const recipeStyleDir = isReferenceMode ? "" : (RECIPE_STYLE_DIRECTION[recipe] ?? "");

  let finalPrompt: string;

  if (isReferenceMode && refCtx) {
    // Reference mode: constraint block FIRST (max token weight), then fluxPrompt if GPT-4o provided one
    const constraintBlock = buildImageConstraintPrefix(refCtx, prompt ?? fluxPrompt ?? "");
    const basePrompt = fluxPrompt || buildImagePrompt(prompt ?? "", brief as DesignBrief | undefined, refCtx);
    finalPrompt = [constraintBlock, basePrompt, closingSuffix, GRAPHIC_QUALITY_SUFFIX]
      .filter(Boolean)
      .join(" ");
  } else if (fluxPrompt) {
    // Preset mode with GPT-4o-generated fluxPrompt
    finalPrompt = [fluxPrompt, recipeStyleDir, closingSuffix, GRAPHIC_QUALITY_SUFFIX]
      .filter(Boolean)
      .join(" ");
  } else {
    // Preset mode, no fluxPrompt — build from prompt + brief + reference
    const basePrompt = buildImagePrompt(
      prompt ?? "",
      brief as DesignBrief | undefined,
      refCtx,
    );
    finalPrompt = [basePrompt, recipeStyleDir, GRAPHIC_QUALITY_SUFFIX]
      .filter(Boolean)
      .join(" ");
  }

  // Always log — visible in Next.js server stdout
  console.log("[image/route] ── IMAGE GENERATION DEBUG ──");
  console.log("[image/route] styleSource:       ", styleSource ?? "(not provided — defaults to preset)");
  console.log("[image/route] isReferenceMode:   ", isReferenceMode);
  console.log("[image/route] hardMode:          ", hardMode);
  console.log("[image/route] recipe:            ", isReferenceMode ? "(SUPPRESSED)" : recipe);
  console.log("[image/route] recipeStyleDir:    ", isReferenceMode ? "(SUPPRESSED)" : (recipeStyleDir ? recipeStyleDir.slice(0, 60) + "…" : "(none)"));
  console.log("[image/route] fluxPrompt from layout:", !!fluxPrompt);
  console.log("[image/route] reference.references count:", refCtx?.references?.length ?? 0);
  console.log("[image/route] reference analysis exists:", refCtx?.references?.some((r: {analysis?: unknown}) => r.analysis != null) ?? false);
  console.log("[image/route] Final prompt (" + finalPrompt.length + " chars):\n", finalPrompt);
  console.log("[image/route] ──────────────────────────────");

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
    console.error("Flux image generation error:", err);
    const gradientUrl = mockGradientDataUrl(recipe, width ?? 800, height ?? 1200);
    return NextResponse.json({ url: gradientUrl, demo: true });
  }
}
