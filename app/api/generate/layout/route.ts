import { NextRequest, NextResponse } from "next/server";
import type {
  PosterSetupConfig,
  Layer,
  CanvasConfig,
  CanvasSize,
} from "@/types/poster";
import { CANVAS_SIZES } from "@/types/poster";
import { v4 as uuidv4 } from "uuid";
import { mockLayout } from "@/lib/mockLayout";

function getCanvasConfig(setup: PosterSetupConfig): CanvasConfig {
  if (setup.canvasSize === "custom") {
    return {
      size: "custom",
      width: setup.customWidth ?? 800,
      height: setup.customHeight ?? 600,
    };
  }
  return CANVAS_SIZES[setup.canvasSize as Exclude<CanvasSize, "custom">];
}

function buildSystemPrompt(): string {
  return `You are a world-class graphic designer who creates sophisticated poster layouts.
You output ONLY valid JSON — no markdown, no code fences, no explanation.
The JSON must exactly match the schema provided.`;
}

function buildUserPrompt(
  setup: PosterSetupConfig,
  canvas: CanvasConfig
): string {
  const textInstructions = setup.aiWriteCopy
    ? `Generate appropriate ${setup.posterType === "film" ? "film" : "exhibition"} poster copy.
       For film: create a compelling title, tagline, and minimal credits.
       For exhibition: create an exhibition title, artist/curator name, venue, and dates.`
    : `Use ONLY the user-provided text. Do not invent any copy.
       Title: ${setup.userTitle || "(no title provided — leave text empty)"}
       Subtitle: ${setup.userSubtitle || "(no subtitle)"}
       Date/Location: ${setup.userDateLocation || "(no date/location)"}
       Credits: ${setup.userCredits || "(no credits)"}`;

  const languageNote =
    setup.language === "bilingual"
      ? "Use both English and Chinese text in title/subtitle layers."
      : setup.language === "chinese"
        ? "Use Chinese text."
        : "Use English text.";

  return `Create a poster layout for:
Poster type: ${setup.posterType}
Canvas: ${canvas.width}x${canvas.height}px
Style: ${setup.stylePreset}
Language: ${setup.language} — ${languageNote}
User prompt: ${setup.prompt || "No specific prompt provided."}

${textInstructions}

Return a JSON object with this exact structure:
{
  "layers": [
    {
      "id": "uuid-string",
      "type": "background-image" | "title-text" | "subtitle-text" | "date-location-text" | "credits-text" | "foreground-cutout" | "user-text",
      "label": "human readable label",
      "x": number,
      "y": number,
      "width": number,
      "height": number,
      "rotation": number (degrees),
      "opacity": number (0-1),
      "visible": true,
      "locked": false,
      "zIndex": number (higher = on top),
      "textData": { (only for text layers)
        "text": "the actual text content",
        "fontSize": number,
        "fontFamily": "font name",
        "fontStyle": "normal" | "bold" | "italic",
        "fill": "#hexcolor",
        "align": "left" | "center" | "right",
        "letterSpacing": number,
        "lineHeight": number
      },
      "imageData": { (only for image layers)
        "src": "",
        "fit": "fill"
      }
    }
  ],
  "imagePrompt": "A detailed Stable Diffusion prompt for generating the background image that matches the ${setup.stylePreset} style and '${setup.prompt}' concept",
  "designNotes": "Brief description of the design choices"
}

Style guidelines for ${setup.stylePreset}:
${getStyleGuidelines(setup.stylePreset)}

Important rules:
- Always include a background-image layer at zIndex 1
- Title text should be large and prominent
- All coordinates and dimensions must fit within ${canvas.width}x${canvas.height}
- Leave background-image src empty string — it will be filled by the image generation step
- For foreground-cutout layer, also leave src empty
- Use sophisticated typographic choices appropriate for the style
- Vary font sizes dramatically for visual hierarchy`;
}

function getStyleGuidelines(style: string): string {
  const guidelines: Record<string, string> = {
    cinematic:
      "Dark, moody palette. Bold title treatment. Widescreen proportions. Use Helvetica or similar sans-serif. High contrast. Often centered composition.",
    "gallery-minimal":
      "White space is key. Small, refined typography. Thin weights. Monochromatic or very limited palette. Swiss-influenced grid.",
    brutalist:
      "Raw, unconventional layouts. Heavy black typography. Asymmetric. Mixed scales. Impact or similar display fonts. High contrast black/white.",
    editorial:
      "Magazine-like. Strong typographic hierarchy. Mix of serif and sans-serif. Pull quotes. Grid-based but dynamic.",
    surreal:
      "Unexpected compositions. Overlapping elements. Dreamy palette. Mix of styles. Text can be rotated or scattered.",
    experimental:
      "Break conventions. Fragment text. Unusual angles. Layers that clash intentionally. Push the boundaries.",
  };
  return guidelines[style] ?? "Create a visually striking poster design.";
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const setup: PosterSetupConfig = body.setup;
  const lockedLayers: Layer[] = body.lockedLayers ?? [];

  const canvas = getCanvasConfig(setup);

  // Demo mode: no API key configured
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

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    let parsed: { layers: Layer[]; imagePrompt: string; designNotes: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
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
    return NextResponse.json(
      { error: "Failed to generate layout" },
      { status: 500 }
    );
  }
}
