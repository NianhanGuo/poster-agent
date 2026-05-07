import { NextRequest, NextResponse } from "next/server";
import { mockGradientDataUrl } from "@/lib/mockGradient";
import type { DesignBrief } from "@/types/poster";
import {
  buildReferenceSection,
  buildImageConstraintPrefix,
  isHardConstraintMode,
} from "@/lib/referencePrompt";
import type { EnrichedRefCtx } from "@/lib/referencePrompt";

function pickDallE3Size(width: number, height: number): "1024x1024" | "1024x1792" | "1792x1024" {
  const ratio = width / height;
  if (ratio > 1.2) return "1792x1024";
  if (ratio < 0.8) return "1024x1792";
  return "1024x1024";
}

/**
 * Builds the final DALL-E prompt.
 *
 * Hard-constraint path (strict mode or strength ≥ 80):
 *   1. Hard constraint block (constraints FIRST — DALL-E weights early text)
 *   2. Subject concept (in abstract mode, already reframed inside the constraint block)
 *   3. Composition/negative-space from brief (non-conflicting structural hints only)
 *   4. Hard rules
 *
 * Normal path:
 *   1. Base prompt
 *   2. Brief directives (mood, composition, imageStrategy, colorStrategy, negativeSpace)
 *   3. Reference section
 *   4. Hard rules
 */
function buildImagePrompt(
  basePrompt: string,
  brief?: DesignBrief,
  reference?: EnrichedRefCtx,
): string {
  const hardMode = reference ? isHardConstraintMode(reference) : false;

  if (hardMode && reference) {
    // ── Hard constraint path ──────────────────────────────────────────────────
    const constraintBlock = buildImageConstraintPrefix(reference, basePrompt);
    const parts: string[] = [];

    if (constraintBlock) parts.push(constraintBlock);

    // Only include structural brief hints that are unlikely to conflict with the reference visual
    if (brief) {
      // Composition and negative-space are structural — safe to include
      switch (brief.composition) {
        case "asymmetric":  parts.push("Asymmetric, off-center composition."); break;
        case "edge-heavy":  parts.push("Elements at canvas edges, large central void."); break;
        case "grid":        parts.push("Structured grid composition."); break;
      }
      if (brief.negativeSpace === "high") {
        parts.push("Extensive negative space. Subject occupies at most 30% of frame.");
      }
      // Skip: brief.mood, brief.colorStrategy, brief.imageStrategy — reference overrides these
    }

    parts.push(
      "No text, no letters, no typography, no words, no captions, no watermarks, no UI elements.",
      "Leave intentional negative space for title overlay.",
    );

    return parts.join(" ");
  }

  // ── Normal path ───────────────────────────────────────────────────────────
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
    "No text, no letters, no typography, no words, no captions, no watermarks, no UI elements.",
    "Leave intentional negative space for title overlay.",
    "Photographic quality or painterly illustration — no AI artifacts.",
  );

  return parts.join(" ");
}

export async function POST(req: NextRequest) {
  const { prompt, styleRecipe, style, width, height, brief, reference } = await req.json();
  const recipe = styleRecipe ?? style ?? "cinematic-rain";

  if (!process.env.OPENAI_API_KEY) {
    const gradientUrl = mockGradientDataUrl(recipe, width ?? 800, height ?? 1200);
    return NextResponse.json({ url: gradientUrl, demo: true });
  }

  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const refCtx = reference as EnrichedRefCtx | undefined;
    const hardMode = refCtx ? isHardConstraintMode(refCtx) : false;

    const size = pickDallE3Size(width ?? 800, height ?? 1200);
    const finalPrompt = buildImagePrompt(
      prompt ?? "",
      brief as DesignBrief | undefined,
      refCtx,
    );

    if (process.env.NODE_ENV !== "production") {
      console.log("[image/route] Hard constraint mode:", hardMode);
      console.log("[image/route] Final DALL-E prompt length:", finalPrompt.length);
      console.log("[image/route] Final prompt:\n", finalPrompt);
    }

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      size,
      response_format: "b64_json",
      // Use "hd" for strict/hard-constraint mode — gives the model more capacity to follow detailed constraints
      quality: hardMode ? "hd" : "standard",
      n: 1,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned");

    const dataUrl = `data:image/png;base64,${b64}`;
    // Return promptPreview so the debug panel can display exactly what was sent
    return NextResponse.json({ url: dataUrl, demo: false, promptPreview: finalPrompt });
  } catch (err) {
    console.error("Image generation error:", err);
    const gradientUrl = mockGradientDataUrl(recipe, width ?? 800, height ?? 1200);
    return NextResponse.json({ url: gradientUrl, demo: true });
  }
}
