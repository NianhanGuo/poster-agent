import { NextRequest, NextResponse } from "next/server";
import { mockGradientDataUrl } from "@/lib/mockGradient";

function pickDallE3Size(width: number, height: number): "1024x1024" | "1024x1792" | "1792x1024" {
  const ratio = width / height;
  if (ratio > 1.2) return "1792x1024";
  if (ratio < 0.8) return "1024x1792";
  return "1024x1024";
}

export async function POST(req: NextRequest) {
  const { prompt, styleRecipe, style, width, height } = await req.json();
  const recipe = styleRecipe ?? style ?? "cinematic-rain";

  if (!process.env.OPENAI_API_KEY) {
    const gradientUrl = mockGradientDataUrl(recipe, width ?? 800, height ?? 1200);
    return NextResponse.json({ url: gradientUrl, demo: true });
  }

  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const size = pickDallE3Size(width ?? 800, height ?? 1200);

    // Compose a safety-conscious image prompt: explicitly no text
    const imagePrompt = [
      prompt,
      "No text, no letters, no typography, no words, no captions, no watermarks.",
      "Intentional negative space for title overlay.",
      "Photographic quality, cinematic composition.",
    ].join(" ");

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
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
    // Fall back to gradient so the canvas always shows something
    const gradientUrl = mockGradientDataUrl(recipe, width ?? 800, height ?? 1200);
    return NextResponse.json({ url: gradientUrl, demo: true });
  }
}
