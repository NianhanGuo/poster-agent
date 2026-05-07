import { NextRequest, NextResponse } from "next/server";
import type { Layer } from "@/types/poster";

export async function POST(req: NextRequest) {
  const { layers, styleRecipe, style, posterType, language, lockedLayers } =
    await req.json();
  const recipe = styleRecipe ?? style ?? "cinematic-rain";

  // Demo mode: return layers unchanged
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ layers, demo: true });
  }

  const textLayers = (layers as Layer[]).filter(
    (l) => l.type.includes("text") && !lockedLayers.includes(l.id)
  );

  if (textLayers.length === 0) {
    return NextResponse.json({ layers, demo: false });
  }

  const prompt = `You are a typography expert improving poster text layers.
Style recipe: ${recipe}, Poster type: ${posterType}, Language: ${language}

Current text layers (JSON):
${JSON.stringify(textLayers, null, 2)}

Improve ONLY the typography properties (fontSize, fontFamily, fontStyle, fill, align, letterSpacing, lineHeight, x, y, width, height).
Do NOT change the text content.
Return ONLY a JSON array of the improved layers with the same IDs.
Ensure visual hierarchy — vary sizes dramatically.`;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "[]";
    let improved: Layer[];
    try {
      improved = JSON.parse(text);
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      improved = match ? JSON.parse(match[0]) : textLayers;
    }

    const mergedLayers = (layers as Layer[]).map((l) => {
      const updated = improved.find((u) => u.id === l.id);
      return updated ? { ...l, ...updated } : l;
    });

    return NextResponse.json({ layers: mergedLayers, demo: false });
  } catch (err) {
    console.error("Typography improvement error:", err);
    return NextResponse.json(
      { error: "Failed to improve typography" },
      { status: 500 }
    );
  }
}
