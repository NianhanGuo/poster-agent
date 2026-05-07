import { NextRequest, NextResponse } from "next/server";
import type { PosterSetupConfig, PosterLayer, CanvasConfig, CanvasSize, DesignBrief } from "@/types/poster";
import { CANVAS_SIZES } from "@/types/poster";
import { RECIPES } from "@/lib/styleRecipes";
import { v4 as uuidv4 } from "uuid";
import { mockLayout } from "@/lib/mockLayout";
import { buildReferenceSection } from "@/lib/referencePrompt";
import type { EnrichedRefCtx } from "@/lib/referencePrompt";

function getCanvasConfig(setup: PosterSetupConfig): CanvasConfig {
  if (setup.canvasSize === "custom") {
    return { size: "custom", width: setup.customWidth ?? 800, height: setup.customHeight ?? 1200 };
  }
  return CANVAS_SIZES[setup.canvasSize as Exclude<CanvasSize, "custom">];
}

function buildBriefSection(brief: DesignBrief): string {
  return `
DESIGN BRIEF — FOLLOW STRICTLY, this overrides style recipe defaults:
  Mood:                ${brief.mood}
  Composition:         ${brief.composition}
  Typography strategy: ${brief.typographyStrategy}
  Color strategy:      ${brief.colorStrategy}
  Image strategy:      ${brief.imageStrategy}
  Negative space:      ${brief.negativeSpace}${brief.designRationale ? `\n  Director's note:     ${brief.designRationale}` : ""}

Composition guide:
  - "center": primary elements centered, symmetrical
  - "asymmetric": deliberate off-center tension, elements weighted to one side
  - "grid": structured columns, modular spacing
  - "edge-heavy": elements pushed to canvas edges, large void in center
Negative space guide:
  - "high": ≥ 50% canvas empty, minimal elements
  - "medium": balanced fill
  - "low": dense, elements fill most of canvas`;
}

function buildSystemPrompt(): string {
  return `You are a world-class graphic designer specializing in film and exhibition posters.
Your aesthetic references: A24, Criterion Collection, MoMA, Tate, ICA, Taschen.
You always make strong design decisions — never produce safe, generic, or average outputs.
You output ONLY valid JSON — no markdown, no code fences, no prose. The response must be parseable by JSON.parse().`;
}

function buildUserPrompt(
  setup: PosterSetupConfig,
  canvas: CanvasConfig,
  brief?: DesignBrief,
  reference?: EnrichedRefCtx,
): string {
  const recipe = RECIPES[setup.styleRecipe] ?? RECIPES["cinematic-rain"];

  const textInstructions = setup.aiWriteCopy
    ? `Generate compelling ${setup.posterType === "film" ? "film" : "exhibition"} poster copy in the spirit of "${recipe.name}".
       For film: evocative title (2–5 words), minimal tagline, sparse credits line.
       For exhibition: exhibition title, artist/curator name, venue and dates.`
    : `Use ONLY this user-provided text — do NOT invent or alter any copy:
       Title: ${setup.userTitle || "(omit — leave text empty string)"}
       Subtitle: ${setup.userSubtitle || "(omit)"}
       Date/Venue: ${setup.userDateLocation || "(omit)"}
       Credits: ${setup.userCredits || "(omit)"}`;

  const langNote =
    setup.language === "mixed" ? "Use both English and Chinese." :
    setup.language === "zh"    ? "Use Chinese text only." :
                                  "Use English text.";

  const briefSection = brief ? buildBriefSection(brief) : "";
  const refSection   = reference ? buildReferenceSection(reference, "layout") : "";

  return `Create a poster layout JSON.

Canvas: ${canvas.width} × ${canvas.height}px
Poster type: ${setup.posterType}
Style recipe: "${recipe.name}" — ${recipe.tagline}
Language: ${langNote}
Concept: ${setup.prompt || `a ${setup.posterType} poster`}
${briefSection}
${refSection}

Typography from recipe (use as baseline, adjust to match brief and reference):
  Title font: ${recipe.type.titleFamily}, weight ${recipe.type.titleWeight}, letter-spacing ${recipe.type.titleLetterSpacing}
  Body font: ${recipe.type.bodyFamily}
  Title color: ${recipe.type.titleColor} | Body color: ${recipe.type.bodyColor}
  Layout default: title at ${recipe.layout.titlePosition}, density ${recipe.layout.density}
  Background palette: ${recipe.palette.bg} / accent ${recipe.palette.accent}

${textInstructions}

Return a JSON object matching this exact schema:
{
  "layers": [
    {
      "id": "<uuid>",
      "type": "backgroundImage" | "subjectImage" | "titleText" | "subtitleText" | "metaText" | "bodyText" | "foregroundCutout" | "userText",
      "label": "<human readable>",
      "x": <number>, "y": <number>, "width": <number>, "height": <number>,
      "rotation": <number>, "opacity": <0-1>,
      "visible": true, "locked": false, "zIndex": <number>,
      "textData": {
        "text": "<actual text content>",
        "fontSize": <number>, "fontFamily": "<name>",
        "fontStyle": "normal" | "bold" | "italic" | "bold italic",
        "fill": "<#hex>",
        "align": "left" | "center" | "right",
        "letterSpacing": <number>, "lineHeight": <number>
      },
      "imageData": { "src": "", "fit": "fill" }
    }
  ],
  "imagePrompt": "<detailed DALL-E prompt. Include: ${recipe.imageKeywords}. Concept: ${setup.prompt || setup.posterType}. NO text, NO typography, NO letters. Leave negative space for title overlay.${recipe.imageAvoid ? " Avoid: " + recipe.imageAvoid + "." : ""}>",
  "designNotes": "<one sentence summary of the design decisions made>"
}

Hard rules:
- Always include exactly one backgroundImage layer at zIndex 1 with imageData.src = ""
- All x/y/width/height must fit within ${canvas.width}×${canvas.height}
- Title must be dramatically larger than body (3–5× size difference)
- Only textData on text layers; only imageData on image layers
- Never add text inside the imagePrompt`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const setup: PosterSetupConfig = body.setup;
  const lockedLayers: PosterLayer[] = body.lockedLayers ?? [];
  const brief: DesignBrief | undefined = body.brief;
  const reference: EnrichedRefCtx | undefined = body.reference;

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
        { role: "user",   content: buildUserPrompt(setup, canvas, brief, reference) },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    const parsed: { layers: PosterLayer[]; imagePrompt: string; designNotes: string } = JSON.parse(text);

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
