import { NextRequest, NextResponse } from "next/server";
import type { PosterSetupConfig, PosterLayer, CanvasConfig, CanvasSize, DesignBrief } from "@/types/poster";
import { CANVAS_SIZES } from "@/types/poster";
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
  return `You are a world-class graphic designer at the level of Pentagram and Studio Dumbar. You design film festival posters, gallery exhibition materials, and cultural event communications.

Your task: generate a complete multi-layer poster layout as structured JSON. Every design decision must serve the hierarchy, atmosphere, and visual tension of the piece.

FUNDAMENTAL DESIGN PHILOSOPHY:
You are making GRAPHIC DESIGN, not photo collages. The hierarchy of visual elements is:
1. Geometric composition (primary)
2. Color relationships (primary)
3. Typography (primary)
4. Photography/imagery (subordinate — always masked, cropped, or contained within geometric shapes)

Photography serves the design. The design does not serve the photography.
Think Josef Müller-Brockmann, Armin Hofmann, Swiss International Style, Bauhaus.
Every image MUST be clipped/contained in a geometric shape (rect or circle) using clipShape.
Never use a full-bleed image that bleeds to all four edges — that is a photo collage, not graphic design.

DESIGN PRINCIPLES YOU ALWAYS FOLLOW:

1. TYPOGRAPHIC HIERARCHY
   - Maximum 3 type sizes. Ratio between levels: at least 2x.
   - Headline weight contrast: if headline is ultra-bold, body must be light (300). Never two bold weights on the same poster.
   - Letter-spacing: display type (>60px) always gets +8 to +20 tracking. Body type gets 0 to +2. Never negative tracking on small type.
   - Line height: display headlines 0.9-1.0. Body text 1.4-1.6.
   - Vertical text (writingMode: vertical) for secondary info along the edge — a signature of serious editorial design.

2. SPATIAL COMPOSITION
   - Use the canvas as a grid. For a 794x1123px canvas (A4): Margins: 40px minimum on all sides. Columns: mentally divide into 12 columns (each ~59px). Align text baselines to an 8px grid.
   - Negative space is a design element. At least 30% of canvas must be breathing room.
   - Create visual tension: place one element unexpectedly (rotated, bleeding off edge, oversized).
   - Never center everything. Mix centered and left-aligned elements.
   - Typography lives in the flat color zone, NOT on top of the image zone.

3. COLOR DISCIPLINE
   - Maximum 3 colors in the palette (excluding black/white).
   - One dominant (60%), one secondary (30%), one accent (10%).
   - The solidBackground flat color is the breathing room for typography — keep it clean.
   - Ensure 4.5:1 contrast ratio for all body text.
   - Color echo rule: the accent color used in geometric shapes MUST echo a color from the image's content.

4. LAYER DEPTH AND ATMOSPHERE — GEOMETRY-FIRST APPROACH
   Always use this construction:
   L1: solidBackground — flat color fills the entire canvas (palette.background). This is the primary canvas.
   L2: backgroundImage — CLIPPED to a geometric zone using clipShape (never full-bleed).
       clipShape rect example: right column clip = { type: "rect", x: canvasWidth*0.5, y: 0, width: canvasWidth*0.5, height: canvasHeight }
       clipShape circle example: portrait crop = { type: "circle", cx: canvasWidth*0.65, cy: canvasHeight*0.35, radius: canvasWidth*0.3 }
   L3: noiseTexture — grain over entire canvas (opacity 0.04-0.08) for tactile depth.
   L4+: geometricShape — shapes that create structure, echo the clip boundary, and generate rhythm.
   L5+: typography lives in the flat color zone, high contrast against solidBackground.

5. THE 6-LAYER MINIMUM RULE
   Generate at least 6 layers, maximum 10. Required structure:
   L1: solidBackground (zIndex 0) — full-canvas flat color rect
   L2: backgroundImage (zIndex 1) — WITH clipShape defining its geometric container
   L3: noiseTexture (zIndex 2)
   L4: geometricShape or accentLine — echoes or overlaps the clip boundary (zIndex 3)
   L5: metaText — rotated vertical edge text (zIndex 4)
   L6: subtitleText or bodyText (zIndex 5)
   L7: titleText — largest, last, dominant (zIndex 6)

6. FONT PAIRING RULES
   Never use two fonts from the same category. Always pair: one serif display + one geometric sans, OR one grotesque + one mono.
   Style → font pairings:
   diffuse_blur / blur-field: "Cormorant Garamond" (300) + "Space Grotesk" (500)
   cinematic-rain / cinematic_rain: "Anton" (400) + "IBM Plex Mono" (400)
   gallery-minimal / gallery_minimal: "Playfair Display" (700) + "Inter" (300)
   brutalist-wall / brutalist_wall: "Bebas Neue" (400) + "Space Mono" (400)
   surreal-film / surreal_film: "Fraunces" (300) + "DM Mono" (400)
   archive-museum / archive_museum: "IM Fell English" (400) + "Courier Prime" (400)
   experimental-type / experimental_type: "Syne" (700) + "Syne Mono" (400)
   For any other recipe: choose the most appropriate pairing for the concept.

7. THE TENSION RULE
   Every poster needs one unexpected decision:
   - A headline rotated 90° along the left edge
   - One word in the title dramatically oversized (breaking the grid)
   - A geometric shape that bleeds off the canvas edge (x or y < 0) or overlaps the clip boundary
   - A text layer with very high letter-spacing used as a texture
   - A thin accentLine that cuts across the entire canvas width

Return ONLY valid JSON. No markdown, no explanation.`;
}

function buildUserPrompt(
  setup: PosterSetupConfig,
  canvas: CanvasConfig,
  reference?: EnrichedRefCtx,
): string {
  const refSection = reference ? buildReferenceSection(reference, "layout") : "";
  const hasUserImage = !!(setup.imageSource === "upload" || setup.imageSource === "reference");

  return `Design a professional poster layout.

Canvas: ${canvas.width} × ${canvas.height}px
Style recipe: "${setup.styleRecipe}"
Concept: ${setup.prompt || "an intentionally designed poster"}
${setup.posterType && setup.posterType !== "poster" ? `Event type: ${setup.posterType}\n` : ""}User image provided: ${hasUserImage ? "YES — backgroundImage src will be filled later, design around it" : "NO — backgroundImage src will be AI-generated, design around the fluxPrompt atmosphere"}
${refSection}

Return ONLY this JSON structure (no markdown, no code fences):
{
  "layers": [
    {
      "id": "<uuid>",
      "type": "<LayerType>",
      "label": "<human readable>",
      "x": 0, "y": 0, "width": 0, "height": 0,
      "rotation": 0, "opacity": 1,
      "visible": true, "locked": false, "zIndex": 0,
      "blendMode": "normal",
      "textData": { "text": "", "fontSize": 0, "fontFamily": "", "fontWeight": "400", "fontStyle": "normal", "fill": "", "align": "left", "letterSpacing": 0, "lineHeight": 1.2, "textTransform": "none", "writingMode": "horizontal" },
      "imageData": { "src": "", "fit": "fill" },
      "shapeData": { "shapeType": "rect", "fill": "none", "stroke": "#ffffff", "strokeWidth": 1 },
      "overlayData": { "gradientType": "linear", "colors": ["#000000", "transparent"], "direction": 180, "opacity": 0.6 },
      "clipShape": { "type": "rect", "x": 0, "y": 0, "width": 0, "height": 0 },
      "effects": {}
    }
  ],
  "fonts": { "display": "Font Name", "body": "Font Name" },
  "palette": { "dominant": "#hex", "secondary": "#hex", "accent": "#hex", "background": "#hex" },
  "fluxPrompt": "80-100 word atmospheric background description. No text, no typography, no letters. Pure atmospheric image only.",
  "designRationale": "2 sentence explanation of key design decision and tension used"
}

Layer type rules:
- "solidBackground": use shapeData with shapeType "rect", fill = palette.background, stroke = "none", strokeWidth 0. x:0, y:0, width:canvasWidth, height:canvasHeight. zIndex 0.
- "colorOverlay": use overlayData field, no textData
- "noiseTexture": no data fields needed, just x/y/width/height, opacity 0.04-0.08
- "geometricShape": use shapeData field
- "accentLine": use shapeData with shapeType "line", width = canvas width, height = 1
- "titleText" / "subtitleText" / "bodyText" / "metaText": use textData field
- "backgroundImage": use imageData with src: "", MUST include a clipShape property

clipShape for "backgroundImage":
- type "rect": { "type": "rect", "x": <number>, "y": <number>, "width": <number>, "height": <number> }
  Example right-half clip: { "type": "rect", "x": ${Math.round(0.48 * 794)}, "y": 0, "width": ${Math.round(0.52 * 794)}, "height": 1123 }
  Example bottom-two-thirds clip: { "type": "rect", "x": 0, "y": ${Math.round(0.35 * 1123)}, "width": 794, "height": ${Math.round(0.65 * 1123)} }
- type "circle": { "type": "circle", "cx": <number>, "cy": <number>, "radius": <number> }
  Example portrait circle: { "type": "circle", "cx": ${Math.round(0.65 * 794)}, "cy": ${Math.round(0.38 * 1123)}, "radius": ${Math.round(0.28 * 794)} }

IMPORTANT: clipShape coordinates are relative to the CANVAS origin (0,0), not relative to the layer's x/y.
IMPORTANT: The solidBackground + clipped backgroundImage together replace the old full-bleed backgroundImage + colorOverlay pattern.

Only include the relevant data field for each layer type. Do not put textData on shape layers or shapeData on text layers.`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const setup: PosterSetupConfig = body.setup;
  const lockedLayers: PosterLayer[] = body.lockedLayers ?? [];
  const brief: DesignBrief | undefined = body.brief;
  const reference: EnrichedRefCtx | undefined = body.reference;

  const canvas = getCanvasConfig(setup);

  if (!process.env.OPENAI_API_KEY) {
    const mock = mockLayout(setup, canvas);
    const finalLayers = [
      ...lockedLayers,
      ...mock.layers.filter((l) => !lockedLayers.find((ll) => ll.id === l.id)),
    ];
    return NextResponse.json({
      layers: finalLayers,
      canvas,
      imagePrompt: mock.imagePrompt,
      fluxPrompt: mock.fluxPrompt ?? mock.imagePrompt,
      fonts: mock.fonts ?? {},
      palette: mock.palette ?? {},
      designRationale: mock.designRationale ?? mock.designNotes,
      designNotes: mock.designNotes,
      demo: true,
    });
  }

  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Build system prompt — brief section injected into user prompt if present
    const systemContent = buildSystemPrompt();
    const userContent = buildUserPrompt(setup, canvas, reference)
      + (brief ? "\n\n" + buildBriefSection(brief) : "");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemContent },
        { role: "user",   content: userContent },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    const parsed: {
      layers: PosterLayer[];
      fluxPrompt: string;
      designRationale: string;
      fonts?: { display?: string; body?: string };
      palette?: { dominant: string; secondary: string; accent: string; background: string };
    } = JSON.parse(text);

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
      imagePrompt: parsed.fluxPrompt,
      fluxPrompt: parsed.fluxPrompt,
      fonts: parsed.fonts ?? {},
      palette: parsed.palette ?? {},
      designRationale: parsed.designRationale,
      designNotes: parsed.designRationale,
      demo: false,
    });
  } catch (err) {
    console.error("Layout generation error:", err);
    return NextResponse.json({ error: "Failed to generate layout" }, { status: 500 });
  }
}
