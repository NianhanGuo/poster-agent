import { NextRequest, NextResponse } from "next/server";
import type { ReferenceAnalysis } from "@/types/poster";

const SYSTEM_PROMPT = `You are a visual design analyst specializing in poster and graphic design.
Analyze the provided image as a design reference for poster creation.
Output ONLY valid JSON — no markdown, no prose, no explanation.`;

const USER_PROMPT = `Analyze this image as a design reference.

Return exactly this JSON (all fields required):
{
  "palette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "mood": "brief evocative description of emotional tone",
  "composition": "spatial layout, balance, negative space, focal points, hierarchy",
  "typographyStyle": "text treatment if present: weight, size, placement, density, rotation; or 'no text visible'",
  "shapes": "geometric or organic elements, abstract forms, circles/rectangles/lines present",
  "texture": "surface quality: grain, blur, sharpness, material feel, smoothness",
  "lighting": "brightness, contrast, shadows, glow, atmosphere, directionality",
  "visualSummary": "one sentence describing the overall visual treatment suitable for recreating the aesthetic"
}

palette: 3–6 dominant hex colors ordered from most to least dominant.
Be specific and concrete in all descriptions — these drive an AI image generator.`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { imageUrl } = body as { imageUrl?: string };

  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      analysis: null,
      demo: true,
      error: "Vision analysis requires OPENAI_API_KEY",
    });
  }

  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "low" },
            },
            { type: "text", text: USER_PROMPT },
          ],
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    const analysis: ReferenceAnalysis = JSON.parse(text);
    return NextResponse.json({ analysis, demo: false });
  } catch (err) {
    console.error("Reference analysis error:", err);
    // Return 200 so callers degrade gracefully
    return NextResponse.json({
      analysis: null,
      demo: true,
      error: "Vision analysis failed — palette-only mode active",
    });
  }
}
