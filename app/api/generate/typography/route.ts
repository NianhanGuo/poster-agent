import { NextRequest, NextResponse } from "next/server";
import type { PosterLayer } from "@/types/poster";

export async function POST(req: NextRequest) {
  const { layers, styleRecipe, style, posterType, language, lockedLayers } = await req.json();
  const recipe = styleRecipe ?? style ?? "cinematic-rain";

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ layers, demo: true });
  }

  const textLayers = (layers as PosterLayer[]).filter(
    (l) => l.type.endsWith("Text") && !lockedLayers.includes(l.id)
  );

  if (textLayers.length === 0) {
    return NextResponse.json({ layers, demo: false });
  }

  const langNote =
    language === "mixed" ? "bilingual English/Chinese" :
    language === "zh"    ? "Chinese" :
                            "English";

  const systemPrompt = `You are a typography expert specializing in ${posterType === "film" ? "film" : "exhibition"} posters. You output ONLY valid JSON arrays — no markdown, no prose.`;

  const userPrompt = `Improve the typography for a "${recipe}" style poster. Language: ${langNote}.

Current text layers:
${JSON.stringify(textLayers, null, 2)}

Rules:
- Improve ONLY these properties: fontSize, fontFamily, fontStyle, fill, align, letterSpacing, lineHeight, x, y, width, height
- Do NOT change the "text" content or "id" fields
- Create clear visual hierarchy: title should be 3–5× larger than body text
- Font choices must match the recipe aesthetic
- For Chinese text: prefer system CJK fonts (e.g. "Noto Serif SC", "Source Han Sans")
- Return ONLY a JSON array of the improved layer objects with the same IDs, matching this shape:
  [{ "id": "...", "textData": { "fontSize": ..., "fontFamily": "...", ... }, "x": ..., "y": ..., "width": ..., "height": ... }]`;

  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt + '\n\nReturn as: { "layers": [ ... ] }' },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    const parsed: { layers: PosterLayer[] } = JSON.parse(text);
    const improved: PosterLayer[] = Array.isArray(parsed.layers) ? parsed.layers : [];

    const mergedLayers = (layers as PosterLayer[]).map((l) => {
      const updated = improved.find((u) => u.id === l.id);
      if (!updated) return l;
      return {
        ...l,
        x: updated.x ?? l.x,
        y: updated.y ?? l.y,
        width: updated.width ?? l.width,
        height: updated.height ?? l.height,
        textData: updated.textData ? { ...l.textData, ...updated.textData } : l.textData,
      };
    });

    return NextResponse.json({ layers: mergedLayers, demo: false });
  } catch (err) {
    console.error("Typography improvement error:", err);
    return NextResponse.json({ error: "Failed to improve typography" }, { status: 500 });
  }
}
