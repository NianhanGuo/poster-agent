import { NextRequest, NextResponse } from "next/server";
import type { PosterSetupConfig, PosterLayer, CanvasConfig, CanvasSize, DesignBrief } from "@/types/poster";
import { CANVAS_SIZES } from "@/types/poster";
import { v4 as uuidv4 } from "uuid";
import { mockLayout } from "@/lib/mockLayout";
import { buildReferenceSection, buildReferenceStyleInstruction, ROLE_ORDER } from "@/lib/referencePrompt";
import type { EnrichedRefCtx, RefImageCtx } from "@/lib/referencePrompt";
import {
  validatePosterLayout,
  formatIssuesForDirector,
  summariseIssues,
  type ValidationIssue,
} from "@/lib/posterValidation";

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

REFERENCE MODE LAYOUT RULES (applied when a REFERENCE STYLE TO FOLLOW section is present):
- Every geometricShape, colorOverlay, and gradientLayer you add MUST be justified by the reference composition OR the user's concept. No decorative color blocks that don't exist in the reference or concept.
- Layer fills and palette MUST use the reference color palette — not invent new colors.
- Typography style MUST match the reference typographic system — not default to preset recipe fonts.
- The solidBackground fill MUST be the dominant reference color.
- The fluxPrompt you generate MUST explicitly include the user's concept AND the reference style.

Return ONLY valid JSON. No markdown, no explanation.`;
}

function buildUserPrompt(
  setup: PosterSetupConfig,
  canvas: CanvasConfig,
  reference?: EnrichedRefCtx,
): string {
  const hasUserImage = !!(setup.imageSource === "upload" || setup.imageSource === "reference");

  // ── Determine style source ─────────────────────────────────────────────────
  const isReferenceMode =
    setup.styleSource === "reference" &&
    !!reference?.references &&
    reference.references.length > 0;

  // ── Server-side debug log (always emitted — check server stdout) ───────────
  const debugInfo = {
    styleSource:           setup.styleSource ?? "preset (default — styleSource not set)",
    selectedPreset:        isReferenceMode ? "(SUPPRESSED — reference mode active)" : setup.styleRecipe,
    referenceCount:        reference?.references?.length ?? 0,
    referenceAnalysisExists: reference?.references?.some((r) => r.analysis != null) ?? false,
    styleInstruction:      isReferenceMode ? "REFERENCE — preset recipe omitted from prompt" : "PRESET — recipe included in prompt",
  };
  console.log("[layout/route] ── STYLE SOURCE DEBUG ──");
  console.log(JSON.stringify(debugInfo, null, 2));

  // ── Build style section ────────────────────────────────────────────────────
  let styleSection: string;

  if (isReferenceMode) {
    // Reference mode: build complete style spec from analysis, omit preset entirely
    const instruction = buildReferenceStyleInstruction(reference!.references!);
    styleSection = instruction || "STYLE SOURCE: REFERENCE IMAGE (analysis pending — preserve palette if extracted)";
    console.log("[layout/route] Reference style instruction length:", styleSection.length, "chars");
  } else {
    // Preset mode: use recipe, optionally blend reference as supplementary guidance
    styleSection = `Style recipe: "${setup.styleRecipe}"`;
    if (reference) {
      const refSection = buildReferenceSection(reference, "layout");
      if (refSection) styleSection += "\n" + refSection;
    }
  }

  return `Design a professional poster layout.

Canvas: ${canvas.width} × ${canvas.height}px
${styleSection}
Concept: ${setup.prompt || "an intentionally designed poster"}
${setup.posterType && setup.posterType !== "poster" ? `Event type: ${setup.posterType}\n` : ""}User image provided: ${hasUserImage ? "YES — backgroundImage src will be filled later, design around it" : "NO — backgroundImage src will be AI-generated, design around the fluxPrompt atmosphere"}

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
  "fluxPrompt": "<SEE INSTRUCTIONS BELOW>",
  "designRationale": "2 sentence explanation of key design decision and tension used"
}

FLUXPROMPT GENERATION RULES:
The fluxPrompt is sent directly to Flux image generation. It MUST include BOTH:
  (A) The user's concept/subject — explicitly named so it is visually present in the generated image
  (B) The style treatment — palette, blur, texture, mood

If a REFERENCE STYLE TO FOLLOW section exists:
  → Start with the user's concept (Concept: "${setup.prompt || "the poster subject"}")
  → Then describe how that concept looks rendered in the reference style
  → Include specific hex palette values from the reference
  → Include the reference's blur and texture treatment
  → The concept must remain visually present — do NOT replace it with unrelated scenery
  Example for concept="rain" + blurred watery reference:
    "Rain. Falling rain and mist rendered as blurred abstract streaks. Blue-green water palette: #1a4a6a, #2a7a9a. Heavy soft-focus blur, diffused light through rain. Dark background #0a1a28. Water droplets and mist. Fine grain texture. No text."

If NO reference section exists (preset mode):
  → Write an 80-100 word atmospheric description including the concept and the recipe aesthetic.

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

// ─── Post-generation self-check ───────────────────────────────────────────────

interface SelfCheckResult {
  passed: boolean;
  subjectPresent: boolean;
  paletteUsed: boolean;
  noPresetLeakage: boolean;
  failures: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function selfCheckLayout(
  fluxPrompt: string,
  layers: PosterLayer[],
  userPrompt: string,
  refPalette: string[],
  openai: any,
): Promise<SelfCheckResult> {
  const PRESET_LEAK_TERMS = [
    "woodblock", "rothko", "constructivist", "risograph", "bauhaus",
    "cinematic rain", "gallery minimal", "brutalist wall",
    "rodchenko", "el lissitzky", "turrell",
  ];

  const presetLeakInFlux = PRESET_LEAK_TERMS.some((term) =>
    fluxPrompt.toLowerCase().includes(term),
  );

  // Quick local checks first — avoid an extra API call if possible
  const subjectWords = userPrompt.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const subjectInFlux = subjectWords.some((w) => fluxPrompt.toLowerCase().includes(w));

  const flatColors = layers
    .flatMap((l) => [
      l.textData?.fill,
      l.shapeData?.fill,
      l.shapeData?.stroke,
    ])
    .filter(Boolean) as string[];

  // Rough palette check: at least one layer fill should be close to reference
  const paletteOk = refPalette.length === 0 || flatColors.length === 0 || (() => {
    const refHexLower = refPalette.map((h) => h.toLowerCase().replace("#", ""));
    return flatColors.some((fill) => {
      const fillHex = fill.toLowerCase().replace("#", "").slice(0, 6);
      return refHexLower.some((ref) => {
        const r1 = parseInt(fillHex.slice(0, 2), 16);
        const g1 = parseInt(fillHex.slice(2, 4), 16);
        const b1 = parseInt(fillHex.slice(4, 6), 16);
        const r2 = parseInt(ref.slice(0, 2), 16);
        const g2 = parseInt(ref.slice(2, 4), 16);
        const b2 = parseInt(ref.slice(4, 6), 16);
        return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) < 80;
      });
    });
  })();

  const failures: string[] = [];
  if (!subjectInFlux && userPrompt.trim()) failures.push(`fluxPrompt does not mention user subject "${userPrompt}"`);
  if (!paletteOk) failures.push("layout fill colors do not match reference palette");
  if (presetLeakInFlux) failures.push("fluxPrompt contains preset recipe style terms");

  console.log("[layout/route] Self-check:", { subjectInFlux, paletteOk, noPresetLeakage: !presetLeakInFlux, failures });

  return {
    passed: failures.length === 0,
    subjectPresent: subjectInFlux || !userPrompt.trim(),
    paletteUsed: paletteOk,
    noPresetLeakage: !presetLeakInFlux,
    failures,
  };
}

// ─── Creative Director Agent ───────────────────────────────────────────────────

/**
 * Sends draft layers + validation issues to GPT-4o as a layout supervisor.
 * The Director makes targeted repairs: moves/resizes layers, fixes margins,
 * adjusts opacity and z-index. It does NOT redesign — only repairs listed issues.
 *
 * Returns corrected layers and a one-line summary of changes made.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runCreativeDirector(
  draftLayers: PosterLayer[],
  issues: ValidationIssue[],
  canvas: CanvasConfig,
  concept: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  openai: any,
): Promise<{ layers: PosterLayer[]; directorNotes: string }> {
  const W = canvas.width;
  const H = canvas.height;
  const errorCount   = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  const systemPrompt = `You are a Creative Director and Layout Supervisor reviewing a poster composition.
Your task is to fix specific geometric layout issues in a poster layer JSON.
You have expert-level knowledge of poster design, typography placement, and spatial composition.
Return ONLY valid JSON — no markdown, no explanation.`;

  const userPrompt = `CANVAS: ${W} × ${H}px
SAFE MARGINS: 40px on all sides (text layers must stay within these)
USER CONCEPT: "${concept || "poster"}"

ISSUES TO FIX (${errorCount} errors, ${warningCount} warnings — fix ALL errors):
${formatIssuesForDirector(issues)}

CURRENT LAYERS (repair these and return all of them):
${JSON.stringify(draftLayers, null, 2)}

REPAIR RULES — apply exactly:

For out-of-canvas errors:
  x ≥ 0, y ≥ 0, x + width ≤ ${W}, y + height ≤ ${H}
  For rotated layers: rotated AABB must also fit within canvas.
    Estimated AABB width = layer.width × |cos(rotation°)| + layer.height × |sin(rotation°)|
    If AABB overflows: reduce rotation toward 0° until it fits, OR shrink width/height.

For safe-margin errors (text only):
  x ≥ 40, y ≥ 40, x + width ≤ ${W - 40}, y + height ≤ ${H - 40}
  If text is too wide: reduce width to ${W - 80}, then reduce fontSize proportionally.
  If y is too low: move y up to ${H - 80} at most.

For small-font warnings:
  Increase fontSize to the minimum in the issue description.

For low-opacity errors:
  Set opacity ≥ 0.2.

For focal-overlap warnings:
  Reduce opacity of the decorative layer to ≤ 0.35.

For z-order errors:
  Set titleText zIndex ≥ solidBackground zIndex + 3.

COMPOSITION PRINCIPLES (maintain):
  - Title must remain the largest, most prominent text element
  - Do NOT change layer types, textData.text content, or colors
  - Do NOT move background layers (solidBackground, backgroundImage, noiseTexture)
  - Maintain relative hierarchy: title above subtitle above metaText
  - titleText fontSize must remain ≥ 32px after any adjustment
  - All visible text layers must have opacity ≥ 0.15

Return JSON: {
  "layers": [ ...corrected full layers array — include ALL layers, not just changed ones... ],
  "directorNotes": "one-line summary: which layers were changed and how"
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? "{}";
  const result = JSON.parse(text) as { layers?: PosterLayer[]; directorNotes?: string };

  const repairedLayers = (result.layers ?? draftLayers).map((l) => ({
    ...l,
    id:      l.id      || uuidv4(),
    visible: l.visible ?? true,
    locked:  l.locked  ?? false,
  }));

  return {
    layers:        repairedLayers,
    directorNotes: result.directorNotes ?? "(no notes)",
  };
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

    // Always log the full prompt — critical for debugging reference mode
    console.log("[layout/route] ── GPT-4o LAYOUT PROMPT ──");
    console.log("[layout/route] styleSource:", setup.styleSource ?? "preset (default)");
    console.log("[layout/route] isReferenceMode:", setup.styleSource === "reference" && !!reference?.references?.length);
    console.log("[layout/route] reference.references count:", reference?.references?.length ?? 0);
    console.log("[layout/route] User prompt (" + userContent.length + " chars):\n", userContent.slice(0, 2000));
    if (userContent.length > 2000) console.log("[layout/route] ... (truncated, full length:", userContent.length, ")");

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
    console.log("[layout/route] GPT-4o raw response length:", text.length, "chars");
    const parsed: {
      layers: PosterLayer[];
      fluxPrompt: string;
      designRationale: string;
      fonts?: { display?: string; body?: string };
      palette?: { dominant: string; secondary: string; accent: string; background: string };
    } = JSON.parse(text);
    console.log("[layout/route] fluxPrompt from GPT-4o:", parsed.fluxPrompt?.slice(0, 200));
    console.log("[layout/route] palette from GPT-4o:", parsed.palette);
    console.log("[layout/route] fonts from GPT-4o:", parsed.fonts);

    let resultLayers = parsed.layers.map((l) => ({
      ...l,
      id: l.id || uuidv4(),
      visible: true,
      locked: false,
    }));
    let resultFluxPrompt = parsed.fluxPrompt;
    let resultPalette = parsed.palette;
    let resultFonts = parsed.fonts;
    let resultRationale = parsed.designRationale;

    // ── Post-generation self-check (reference mode only) ──────────────────
    const isReferenceMode = setup.styleSource === "reference" && !!reference?.references?.length;
    if (isReferenceMode) {
      const refImages = reference!.references as RefImageCtx[];
      const sorted = [...refImages].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
      const primary = sorted[0];
      const refPaletteHex = (primary?.palette ?? []).map((p) => p.hex);

      const check = await selfCheckLayout(
        resultFluxPrompt ?? "",
        resultLayers as PosterLayer[],
        setup.prompt ?? "",
        refPaletteHex,
        openai,
      );

      if (!check.passed) {
        console.log("[layout/route] ⚠ Self-check FAILED — regenerating with stricter prompt");
        console.log("[layout/route] Failures:", check.failures);

        const stricterContent = userContent
          + `\n\n=== REGENERATION — PREVIOUS OUTPUT FAILED QUALITY CHECK ===\n`
          + `Failures to fix:\n`
          + check.failures.map((f) => `  ✗ ${f}`).join("\n")
          + `\n\nFix these SPECIFICALLY:\n`
          + (!check.subjectPresent && setup.prompt
              ? `  • The fluxPrompt MUST contain the word "${setup.prompt}" and visual terms for it.\n`
              : "")
          + (!check.paletteUsed && refPaletteHex.length > 0
              ? `  • Fill colors in solidBackground and shapes MUST use palette: ${refPaletteHex.join(", ")}.\n`
              : "")
          + (!check.noPresetLeakage
              ? `  • Remove all preset recipe style terms from fluxPrompt.\n`
              : "")
          + `\nGenerate a corrected version now.`;

        try {
          const retryCompletion = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 4096,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemContent },
              { role: "user",   content: stricterContent },
            ],
          });
          const retryText = retryCompletion.choices[0]?.message?.content ?? "{}";
          const retryParsed = JSON.parse(retryText);
          console.log("[layout/route] Retry fluxPrompt:", retryParsed.fluxPrompt?.slice(0, 200));

          resultLayers = retryParsed.layers.map((l: PosterLayer) => ({
            ...l,
            id: l.id || uuidv4(),
            visible: true,
            locked: false,
          }));
          resultFluxPrompt = retryParsed.fluxPrompt ?? resultFluxPrompt;
          resultPalette = retryParsed.palette ?? resultPalette;
          resultFonts = retryParsed.fonts ?? resultFonts;
          resultRationale = retryParsed.designRationale ?? resultRationale;
        } catch (retryErr) {
          console.error("[layout/route] Retry failed:", retryErr);
          // Fall through — use original result
        }
      }
    }

    // ── Creative Director: validate draft layers + repair if needed ──────────
    console.log("[layout/route] ═══ LAYOUT VALIDATION START ═══");
    console.log("[layout/route] Draft layers:", resultLayers.length, "total");
    console.log(
      "[layout/route] Draft summary:",
      resultLayers.map((l) => ({
        type: l.type, label: l.label,
        x: Math.round(l.x), y: Math.round(l.y),
        w: Math.round(l.width), h: Math.round(l.height),
        rot: l.rotation ?? 0, font: (l as PosterLayer).textData?.fontSize,
        opacity: l.opacity,
      })),
    );

    let validationIssues = validatePosterLayout(resultLayers as PosterLayer[], canvas);
    console.log("[layout/route] Initial validation:", summariseIssues(validationIssues));
    if (validationIssues.length > 0) {
      console.log("[layout/route] Issues detail:", validationIssues.map((i) => `[${i.severity}] ${i.type}: ${i.message}`));
    }

    const MAX_REPAIR_ATTEMPTS = 2;
    for (let attempt = 0; attempt < MAX_REPAIR_ATTEMPTS; attempt++) {
      const errorCount = validationIssues.filter((i) => i.severity === "error").length;
      if (errorCount === 0) break;

      console.log(`[layout/route] ─── Director repair attempt ${attempt + 1}/${MAX_REPAIR_ATTEMPTS} — ${errorCount} error(s) ───`);
      try {
        const repair = await runCreativeDirector(
          resultLayers as PosterLayer[],
          validationIssues,
          canvas,
          setup.prompt ?? "",
          openai,
        );

        console.log("[layout/route] Director notes:", repair.directorNotes);
        console.log(
          "[layout/route] Repaired layers summary:",
          repair.layers.map((l) => ({
            type: l.type, label: l.label,
            x: Math.round(l.x), y: Math.round(l.y),
            w: Math.round(l.width), h: Math.round(l.height),
            rot: l.rotation ?? 0,
          })),
        );

        resultLayers = repair.layers;
        // Attach director notes to rationale
        resultRationale = (resultRationale ?? "") + ` [Director: ${repair.directorNotes}]`;

        const remainingIssues = validatePosterLayout(resultLayers, canvas);
        const remainingErrors = remainingIssues.filter((i) => i.severity === "error").length;
        console.log(`[layout/route] After repair ${attempt + 1}: ${summariseIssues(remainingIssues)}`);

        validationIssues = remainingIssues;
        if (remainingErrors === 0) {
          console.log(`[layout/route] ✓ All errors resolved after ${attempt + 1} repair attempt(s)`);
          break;
        }
      } catch (dirErr) {
        console.error("[layout/route] Director repair error:", dirErr);
        break;
      }
    }

    console.log("[layout/route] ═══ FINAL APPROVED LAYOUT ═══");
    console.log(
      "[layout/route] Final layers:",
      resultLayers.map((l) => ({
        type: l.type, label: l.label,
        x: Math.round(l.x), y: Math.round(l.y),
        w: Math.round(l.width), h: Math.round(l.height),
        visible: l.visible, zIndex: l.zIndex,
      })),
    );
    const finalValidation = summariseIssues(validationIssues);
    console.log("[layout/route] Final validation:", finalValidation);

    const finalLayers = [
      ...lockedLayers,
      ...resultLayers.filter((l) => !lockedLayers.find((ll) => ll.id === l.id)),
    ];

    return NextResponse.json({
      layers: finalLayers,
      canvas,
      imagePrompt: resultFluxPrompt,
      fluxPrompt:  resultFluxPrompt,
      fonts:       resultFonts ?? {},
      palette:     resultPalette ?? {},
      designRationale: resultRationale,
      designNotes:     resultRationale,
      validationSummary: finalValidation,
      demo: false,
    });
  } catch (err) {
    console.error("Layout generation error:", err);
    return NextResponse.json({ error: "Failed to generate layout" }, { status: 500 });
  }
}
