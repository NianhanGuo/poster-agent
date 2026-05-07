import { NextRequest, NextResponse } from "next/server";
import type { ReferenceAnalysis } from "@/types/poster";

const SYSTEM_PROMPT = `You are a visual design analyst specializing in poster and graphic design.
Analyze the provided image as a design reference for poster creation.
Output ONLY valid JSON — no markdown, no prose, no explanation.`;

const USER_PROMPT = `Analyze this image as a design reference for an AI poster generator.

Return exactly this JSON (all fields required):
{
  "palette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "mood": "brief evocative description of emotional tone",
  "composition": "spatial layout, balance, negative space, focal points, hierarchy",
  "typographyStyle": "text treatment if present: weight, size, placement, density, rotation; or 'no text visible'",
  "shapes": "geometric or organic elements, abstract forms present",
  "texture": "surface quality: grain, blur, sharpness, smoothness",
  "lighting": "brightness, contrast, shadows, glow, atmosphere",
  "visualSummary": "one sentence describing the overall visual treatment suitable for recreating the aesthetic",
  "brightness": "light",
  "contrast": "low",
  "styleClass": "abstract-poster",
  "forbiddenDrift": ["term1", "term2", "term3"]
}

FIELD RULES:

palette: 3–6 dominant hex colors ordered from most to least dominant. Sample carefully.

brightness (choose exactly one):
  "light" — image is predominantly pale, pastel, bright, or high-key
  "medium" — image has balanced mid-tones
  "dark" — image is predominantly dark, black, or low-key

contrast (choose exactly one):
  "low" — tones blend softly, gradual transitions, no harsh edges between light and dark
  "medium" — moderate tonal range
  "high" — strong separation between darks and lights, dramatic tonal swing

styleClass (choose exactly one):
  "abstract-poster" — non-representational, no identifiable subject, pure visual elements
  "blurred-gradient" — soft focus throughout, color fields bleeding together, no sharp elements
  "geometric-graphic" — clear shapes (circles, rects, lines), flat graphic design aesthetic
  "photographic" — real-world photography: nature, architecture, people, objects
  "illustration" — drawn, painted, collage, clearly hand-made or illustrated look
  "typographic" — dominated by text or letterforms as the main visual element

forbiddenDrift: list exactly 4–6 terms describing what this image is NOT and should NEVER become.
These are auto-generated negative constraints. Be specific to what would be the OPPOSITE aesthetic.
Examples:
  — pale/pastel/abstract image → ["dark cinematic scene", "realistic landscape photography", "fantasy environment", "dramatic shadows", "3D render", "characters or objects"]
  — dark/moody photograph → ["white background", "pastel graphic", "flat illustration", "bright overexposed look"]
  — photographic image → ["abstract blob", "flat graphic design", "typographic poster"]

Be specific and concrete — these drive hard constraints in an AI image generator.`;

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
      max_tokens: 1000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" },
            },
            { type: "text", text: USER_PROMPT },
          ],
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    const raw = JSON.parse(text);

    // Normalise and apply defaults for new fields in case old cached analysis omits them
    const analysis: ReferenceAnalysis = {
      palette:        Array.isArray(raw.palette)        ? raw.palette        : [],
      mood:           raw.mood           ?? "",
      composition:    raw.composition    ?? "",
      typographyStyle: raw.typographyStyle ?? "no text visible",
      shapes:         raw.shapes         ?? "",
      texture:        raw.texture        ?? "",
      lighting:       raw.lighting       ?? "",
      visualSummary:  raw.visualSummary  ?? "",
      brightness:     ["light", "medium", "dark"].includes(raw.brightness)  ? raw.brightness  : "medium",
      contrast:       ["low", "medium", "high"].includes(raw.contrast)      ? raw.contrast    : "medium",
      styleClass:     ["abstract-poster","blurred-gradient","geometric-graphic","photographic","illustration","typographic"].includes(raw.styleClass)
                        ? raw.styleClass : "abstract-poster",
      forbiddenDrift: Array.isArray(raw.forbiddenDrift) ? raw.forbiddenDrift : [],
    };

    return NextResponse.json({ analysis, demo: false });
  } catch (err) {
    console.error("Reference analysis error:", err);
    return NextResponse.json({
      analysis: null,
      demo: true,
      error: "Vision analysis failed — palette-only mode active",
    });
  }
}
