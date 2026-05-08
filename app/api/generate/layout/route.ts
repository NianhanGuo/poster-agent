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
  return `You are a world-class graphic designer and typographer specializing in poster design.
Your aesthetic references: A24, Criterion Collection, MoMA, Tate, ICA, Taschen, Emigre, David Carson, Neville Brody, Swiss International Style.
You make strong, intentional decisions — never safe, never centered by default, never generic.
You understand spatial tension, typographic hierarchy, negative space, and reference-driven design.
Typography is a design element: it has position, scale, rotation, and spatial relationship to the image.
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
    ? `Generate compelling poster copy driven by the brief, reference, and style recipe.
       You decide how many text blocks this design needs — there is no fixed template.
       Think in roles: primary (dominant title), secondary (subtitle or tagline), support (dates, credits, fine text).
       Choose only the blocks that serve the design — 1 strong block often beats 4 weak ones.
       You may use "titleText" | "subtitleText" | "bodyText" | "metaText" | "userText" for any block.
       For experimental or reference-driven layouts, prefer "userText" so placement is unconstrained.
       Text must feel designed and intentional — not safe, centered, or templated.`
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
Style recipe: "${recipe.name}" — ${recipe.tagline}
${setup.posterType && setup.posterType !== "poster" ? `Soft creative context: ${setup.posterType} (use only as a loose tonal hint — brief and reference override this)\n` : ""}Language: ${langNote}
Concept: ${setup.prompt || "an intentionally designed poster"}
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
      "rotation": <degrees — 0 upright; use non-zero for experimental/asymmetric layouts>,
      "opacity": <0–1>,
      "visible": true, "locked": false, "zIndex": <number>,
      "textData": {
        "text": "<actual text content>",
        "fontSize": <number>, "fontFamily": "<name>",
        "fontStyle": "normal" | "bold" | "italic" | "bold italic",
        "fontWeight": <100|200|300|400|500|600|700|800|900>,
        "fill": "<#hex>",
        "align": "left" | "center" | "right",
        "letterSpacing": <number>, "lineHeight": <number>
      },
      "imageData": { "src": "", "fit": "fill" }
    }
  ],
  "imagePrompt": "<detailed DALL-E prompt. Include: ${recipe.imageKeywords}. Concept: ${setup.prompt || setup.posterType}. NO text, NO typography, NO letters. Leave negative space for title overlay.${recipe.imageAvoid ? " Avoid: " + recipe.imageAvoid + "." : ""}>",
  "designNotes": "<one sentence summary of the core design decision>"
}

Layout rules:
- Always include exactly one backgroundImage layer at zIndex 1 with imageData.src = ""
- Text layers MAY extend beyond canvas edges for dramatic effect — this is encouraged, not an error
- Create strong visual hierarchy — the scale ratio between primary and secondary text is your design decision
- DO NOT default to centered or balanced layouts unless the brief/reference explicitly calls for it
- rotation: use non-zero angles for tension, asymmetry, or reference-derived orientation (vertical = 90°)
- Text blocks may overlap intentionally — let them collide when it serves the composition
- Safe margins are optional — push text to edges, corners, and extremes when the design calls for it
- Only textData on text layers; only imageData on image layers
- Never add text inside the imagePrompt
- Avoid repetitive fixed patterns (title-at-bottom, subtitle-above) — let brief and reference drive all placement`;
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
