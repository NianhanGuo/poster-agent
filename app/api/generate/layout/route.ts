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
  return `You are a world-class graphic designer specializing in film and exhibition posters. Your aesthetic references: A24, Criterion Collection, MoMA, Tate, ICA. You output ONLY valid JSON — no markdown, no code fences, no explanation.`;
}

function buildUserPrompt(setup: PosterSetupConfig, canvas: CanvasConfig): string {
  const recipe = RECIPES[setup.styleRecipe] ?? RECIPES["cinematic-rain"];

  const textInstructions = setup.aiWriteCopy
    ? `Generate compelling ${setup.posterType === "film" ? "film" : "exhibition"} poster copy in the spirit of ${recipe.name}.
       For film: evocative title, minimal tagline, sparse credits.
       For exhibition: exhibition title, artist or curator, venue, dates.`
    : `Use ONLY the user-provided text:
       Title: ${setup.userTitle || "(omit)"}
       Subtitle: ${setup.userSubtitle || "(omit)"}
       Date/Venue: ${setup.userDateLocation || "(omit)"}
       Credits: ${setup.userCredits || "(omit)"}`;

  const langNote =
    setup.language === "mixed"
      ? "Use both English and Chinese text."
      : setup.language === "zh"
        ? "Use Chinese text."
        : "Use English text.";

  return `Create a poster layout.

Canvas: ${canvas.width} × ${canvas.height}px
Poster type: ${setup.posterType}
Style recipe: ${recipe.name} — ${recipe.tagline}
Language: ${langNote}
Concept: ${setup.prompt || `a ${setup.posterType} poster`}

Style recipe directives:
- Title font: ${recipe.type.titleFamily}, ${recipe.type.titleWeight}, ${recipe.type.titleAlign} aligned, letter-spacing ${recipe.type.titleLetterSpacing}
- Body font: ${recipe.type.bodyFamily}
- Title color: ${recipe.type.titleColor}
- Body color: ${recipe.type.bodyColor}
- Layout: title at ${recipe.layout.titlePosition}, ${recipe.layout.align} aligned, ${recipe.layout.density} density
- Palette: bg ${recipe.palette.bg}, surface ${recipe.palette.surface}, accent ${recipe.palette.accent}

${textInstructions}

Return a JSON object with EXACTLY this structure:
{
  "layers": [
    {
      "id": "uuid",
      "type": "backgroundImage" | "subjectImage" | "titleText" | "subtitleText" | "metaText" | "bodyText" | "foregroundCutout" | "userText",
      "label": "human readable",
      "x": number,
      "y": number,
      "width": number,
      "height": number,
      "rotation": number,
      "opacity": number (0-1),
      "visible": true,
      "locked": false,
      "zIndex": number,
      "textData": {
        "text": "actual text",
        "fontSize": number,
        "fontFamily": "font name",
        "fontStyle": "normal" | "bold" | "italic" | "bold italic",
        "fill": "#hex",
        "align": "left" | "center" | "right",
        "letterSpacing": number,
        "lineHeight": number
      },
      "imageData": { "src": "", "fit": "fill" }
    }
  ],
  "imagePrompt": "Detailed image generation prompt incorporating: ${recipe.imageKeywords}. ${setup.prompt ? `Concept: ${setup.prompt}.` : ""} ${recipe.imageAvoid ? `Avoid: ${recipe.imageAvoid}.` : ""}",
  "designNotes": "Brief description of design decisions"
}

Rules:
- Always include a backgroundImage layer at zIndex 1 with imageData.src = ""
- All coordinates must fit within ${canvas.width}x${canvas.height}
- Use dramatic typographic scale for visual hierarchy
- Positions must match the recipe's layout directives precisely`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const setup: PosterSetupConfig = body.setup;
  const lockedLayers: Layer[] = body.lockedLayers ?? [];

  const canvas = getCanvasConfig(setup);

  if (!process.env.ANTHROPIC_API_KEY) {
    const { layers, imagePrompt, designNotes } = mockLayout(setup, canvas);
    const finalLayers = [
      ...lockedLayers,
      ...layers.filter((l) => !lockedLayers.find((ll) => ll.id === l.id)),
    ];
    return NextResponse.json({ layers: finalLayers, canvas, imagePrompt, designNotes, demo: true });
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(setup, canvas) }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    let parsed: { layers: Layer[]; imagePrompt: string; designNotes: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    }

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
