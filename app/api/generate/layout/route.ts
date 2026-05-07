import { NextRequest, NextResponse } from "next/server";
import type { PosterSetupConfig, Layer, CanvasConfig, CanvasSize } from "@/types/poster";
import { CANVAS_SIZES } from "@/types/poster";
import { RECIPES } from "@/lib/styleRecipes";
import { v4 as uuidv4 } from "uuid";
import { mockLayout } from "@/lib/mockLayout";

function getCanvasConfig(setup: PosterSetupConfig): CanvasConfig {
  if (setup.canvasSize === "custom") {
    return { size: "custom", width: setup.customWidth ?? 800, height: setup.customHeight ?? 1200 };
  }
  return CANVAS_SIZES[setup.canvasSize as Exclude<CanvasSize, "custom">];
}

function buildSystemPrompt(): string {
  return `You are a world-class graphic designer specializing in film and exhibition posters. Your aesthetic references: A24, Criterion Collection, MoMA, Tate, ICA.
You output ONLY valid JSON — no markdown, no code fences, no prose, no explanation. The response must be parseable by JSON.parse() with no preprocessing.`;
}

function buildUserPrompt(setup: PosterSetupConfig, canvas: CanvasConfig): string {
  const recipe = RECIPES[setup.styleRecipe] ?? RECIPES["cinematic-rain"];

  const textInstructions = setup.aiWriteCopy
    ? `Generate compelling ${setup.posterType === "film" ? "film" : "exhibition"} poster copy in the spirit of "${recipe.name}".
       For film: evocative title, minimal tagline, sparse credits.
       For exhibition: exhibition title, artist or curator, venue, and dates.`
    : `Use ONLY this user-provided text — do not invent any copy:
       Title: ${setup.userTitle || "(omit — leave text empty)"}
       Subtitle: ${setup.userSubtitle || "(omit)"}
       Date/Venue: ${setup.userDateLocation || "(omit)"}
       Credits: ${setup.userCredits || "(omit)"}`;

  const langNote =
    setup.language === "mixed" ? "Use both English and Chinese." :
    setup.language === "zh"    ? "Use Chinese text." :
                                  "Use English text.";

  return `Create a poster layout JSON object.

Canvas: ${canvas.width} × ${canvas.height}px
Poster type: ${setup.posterType}
Style recipe: "${recipe.name}" — ${recipe.tagline}
Language: ${langNote}
Concept: ${setup.prompt || `a ${setup.posterType} poster`}

Typography directives from the style recipe:
- Title font: ${recipe.type.titleFamily}, weight ${recipe.type.titleWeight}, ${recipe.type.titleAlign} aligned, letter-spacing ${recipe.type.titleLetterSpacing}
- Body font: ${recipe.type.bodyFamily}
- Title color: ${recipe.type.titleColor}, Body color: ${recipe.type.bodyColor}
- Layout: title at ${recipe.layout.titlePosition}, alignment ${recipe.layout.align}, density ${recipe.layout.density}
- Background palette: bg ${recipe.palette.bg}, surface ${recipe.palette.surface}, accent ${recipe.palette.accent}

${textInstructions}

Respond with a JSON object matching this exact schema:
{
  "layers": [
    {
      "id": "<uuid>",
      "type": "backgroundImage" | "subjectImage" | "titleText" | "subtitleText" | "metaText" | "bodyText" | "foregroundCutout" | "userText",
      "label": "<human readable string>",
      "x": <number>,
      "y": <number>,
      "width": <number>,
      "height": <number>,
      "rotation": <number degrees>,
      "opacity": <number 0-1>,
      "visible": true,
      "locked": false,
      "zIndex": <number>,
      "textData": {
        "text": "<actual text content>",
        "fontSize": <number>,
        "fontFamily": "<font name>",
        "fontStyle": "normal" | "bold" | "italic" | "bold italic",
        "fill": "<#hex color>",
        "align": "left" | "center" | "right",
        "letterSpacing": <number>,
        "lineHeight": <number>
      },
      "imageData": { "src": "", "fit": "fill" }
    }
  ],
  "imagePrompt": "<detailed image generation prompt incorporating: ${recipe.imageKeywords}. Concept: ${setup.prompt || setup.posterType}. Explicitly exclude text, typography, and lettering. Leave negative space for overlaid text.${recipe.imageAvoid ? " Avoid: " + recipe.imageAvoid + "." : ""}>",
  "designNotes": "<brief description of design decisions>"
}

Rules:
- Always include a backgroundImage layer at zIndex 1 with imageData.src set to ""
- All x/y/width/height coordinates must fit within ${canvas.width}×${canvas.height}
- Use dramatic typographic scale (3–5× size difference between title and body)
- titleText layer must follow the recipe's titlePosition and alignment exactly
- Only include textData on text layers; only include imageData on image layers`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const setup: PosterSetupConfig = body.setup;
  const lockedLayers: Layer[] = body.lockedLayers ?? [];

  const canvas = getCanvasConfig(setup);

  if (!process.env.OPENAI_API_KEY) {
    const { layers, imagePrompt, designNotes } = mockLayout(setup, canvas);
    const finalLayers = [
      ...lockedLayers,
      ...layers.filter((l) => !lockedLayers.find((ll) => ll.id === l.id)),
    ];
    return NextResponse.json({ layers: finalLayers, canvas, imagePrompt, designNotes, demo: true });
  }

  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user",   content: buildUserPrompt(setup, canvas) },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    const parsed: { layers: Layer[]; imagePrompt: string; designNotes: string } = JSON.parse(text);

    const newLayers = parsed.layers.map((l) => ({
      ...l,
      id: l.id || uuidv4(),
      visible: true,
      locked: false,
    }));

    const finalLayers = [
      ...lockedLayers,
      ...newLayers.filter((l) => !lockedLayers.find((ll) => ll.id === l.id)),
    ];

    return NextResponse.json({
      layers: finalLayers,
      canvas,
      imagePrompt: parsed.imagePrompt,
      designNotes: parsed.designNotes,
      demo: false,
    });
  } catch (err) {
    console.error("Layout generation error:", err);
    return NextResponse.json({ error: "Failed to generate layout" }, { status: 500 });
  }
}
