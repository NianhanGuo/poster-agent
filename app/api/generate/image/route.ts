import { NextRequest, NextResponse } from "next/server";
import { mockGradientDataUrl } from "@/lib/mockGradient";
import { buildPalettePrompt } from "@/lib/colorExtract";
import type { DesignBrief } from "@/types/poster";
import type { PaletteColor } from "@/lib/colorExtract";

interface ReferenceContext {
  strength: number;
  targets: Record<string, boolean>;
  instruction?: string;
  hasImage?: boolean;
  palette?: PaletteColor[];
}

function pickDallE3Size(width: number, height: number): "1024x1024" | "1024x1792" | "1792x1024" {
  const ratio = width / height;
  if (ratio > 1.2) return "1792x1024";
  if (ratio < 0.8) return "1024x1792";
  return "1024x1024";
}

function buildImagePrompt(
  basePrompt: string,
  brief?: DesignBrief,
  reference?: ReferenceContext,
): string {
  const parts: string[] = [basePrompt];

  // Design brief directives
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

  // Extracted palette enforcement (hex-level, strength-tiered)
  if (reference?.palette && reference.palette.length > 0) {
    const paletteSection = buildPalettePrompt(
      reference.palette,
      reference.strength,
      !!reference.targets.color,
    );
    if (paletteSection) parts.push(paletteSection);
  }

  // Additional reference instruction for non-color targets
  if (reference?.instruction && reference.strength > 30) {
    const targets = reference.targets;
    const nonColorTarget =
      targets.mood || targets.backgroundStyle || targets.texture || targets.lighting;
    if (nonColorTarget) {
      parts.push(`Reference guidance: ${reference.instruction}`);
    }
  }

  // Hard rules
  parts.push(
    "No text, no letters, no typography, no words, no captions, no watermarks, no UI elements.",
    "Leave intentional negative space for title overlay.",
    "Photographic quality. Cinematic composition.",
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

    const size = pickDallE3Size(width ?? 800, height ?? 1200);
    const finalPrompt = buildImagePrompt(prompt ?? "", brief, reference);

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      size,
      response_format: "b64_json",
      quality: "standard",
      n: 1,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned");

    const dataUrl = `data:image/png;base64,${b64}`;
    return NextResponse.json({ url: dataUrl, demo: false });
  } catch (err) {
    console.error("Image generation error:", err);
    const gradientUrl = mockGradientDataUrl(recipe, width ?? 800, height ?? 1200);
    return NextResponse.json({ url: gradientUrl, demo: true });
  }
}
