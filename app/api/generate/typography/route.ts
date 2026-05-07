import { NextRequest, NextResponse } from "next/server";
import type { PosterLayer } from "@/types/poster";
import type { PaletteColor } from "@/lib/colorExtract";

type StyleHint = "cinematic" | "editorial" | "brutalist" | "fit-to-canvas" | "improve" | undefined;

interface ReferenceContext {
  strength: number;
  targets: Record<string, boolean>;
  instruction?: string;
  palette?: PaletteColor[];
}

function buildStyleDirective(hint: StyleHint, recipe: string): string {
  switch (hint) {
    case "cinematic":
      return `Make the typography feel CINEMATIC and A24-quality.
  - Dominant title in all-caps with wide letter-spacing (8–20)
  - Use dramatic scale contrast (title 5× larger than body)
  - Prefer: Impact, Bebas Neue, Anton, or Oswald for title
  - Body in a fine serif or thin sans (EB Garamond, Cormorant)
  - Title near bottom third, body sparse and minimal`;

    case "editorial":
      return `Make the typography feel EDITORIAL and intellectual.
  - Title in a refined serif (Playfair Display, EB Garamond, Cormorant)
  - Body in a complementary serif or humanist sans
  - Moderate tracking, generous line height (1.4–1.6)
  - Clear editorial hierarchy: title, subtitle, body, credits
  - Avoid heavy weights — prefer 300–500 range`;

    case "brutalist":
      return `Make the typography feel BRUTALIST — raw, confrontational, system.
  - Title in Impact or Bebas Neue, negative letter-spacing (−2 to −5)
  - Fill entire width if horizontal poster, stack words vertically
  - Monospaced or condensed secondary type
  - High contrast: pure white or pure red on black
  - Dense, no wasted space`;

    case "fit-to-canvas":
      return `Fit text to use the canvas more effectively.
  - Redistribute text layers to use all zones of the canvas
  - Title should span at least 70% of canvas width
  - Avoid clustering all text in one corner
  - Maintain visual hierarchy while filling the space
  - Ensure no text extends beyond canvas bounds`;

    default:
      return `Improve overall typography quality for a "${recipe}" style poster.
  - Create clear visual hierarchy
  - Match font choices to the aesthetic
  - Optimize spacing, sizing, and positioning`;
  }
}

export async function POST(req: NextRequest) {
  const {
    layers,
    styleRecipe,
    style,
    posterType,
    language,
    lockedLayers,
    styleHint,
    reference,
    canvasWidth,
    canvasHeight,
  } = await req.json();

  const recipe = styleRecipe ?? style ?? "cinematic-rain";

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ layers, demo: true });
  }

  // Filter to unlocked text layers only
  const textLayers = (layers as PosterLayer[]).filter(
    (l) => l.type.endsWith("Text") && !lockedLayers?.includes(l.id),
  );

  if (textLayers.length === 0) {
    return NextResponse.json({ layers, demo: false });
  }

  const langNote =
    language === "mixed" ? "bilingual English/Chinese" :
    language === "zh"    ? "Chinese" : "English";

  const styleDirective = buildStyleDirective(styleHint as StyleHint, recipe);

  const ref = reference as ReferenceContext | undefined;

  // Palette color guidance for text fills
  let refNote = "";
  if (ref?.palette && ref.palette.length > 0) {
    const colorActive   = ref.targets?.color;
    const typoActive    = ref.targets?.typography;
    if (colorActive || typoActive) {
      const titleColor =
        ref.palette.find((p) => p.role === "accent")?.hex ??
        ref.palette.find((p) => p.role === "highlight")?.hex ??
        ref.palette[1]?.hex;
      const bodyColor =
        ref.palette.find((p) => p.role === "highlight")?.hex ??
        ref.palette[2]?.hex;
      const enforcement = (ref.strength ?? 50) >= 71 ? "STRICT — use exactly" : "preferred";

      refNote += `\nReference color palette (${enforcement}): ${ref.palette.map((p) => `${p.hex}(${p.role})`).join(", ")}`;
      if (titleColor) refNote += `\n  → Title text fill: ${titleColor}`;
      if (bodyColor)  refNote += `\n  → Body/meta text fill: ${bodyColor}`;
      refNote += "\n  → Do NOT use colors outside this palette for text fills.";
    }
  }
  if (ref?.instruction && ref.targets?.typography) {
    refNote += `\nReference typography guidance: ${ref.instruction}`;
  }

  const systemPrompt = `You are a typography expert and art director specializing in ${posterType === "film" ? "film" : "exhibition"} posters.
You make bold, intentional typographic decisions — never safe or average.
You output ONLY valid JSON — no markdown, no prose.`;

  const userPrompt = `Upgrade the typography for a "${recipe}" poster. Language: ${langNote}.
Canvas: ${canvasWidth ?? 800} × ${canvasHeight ?? 1200}px
${styleDirective}${refNote}

Current text layers (improve these — do NOT change "text" or "id" values):
${JSON.stringify(textLayers, null, 2)}

Rules:
- Improve ONLY: fontSize, fontFamily, fontStyle, fontWeight, fill, align, letterSpacing, lineHeight, x, y, width, height
- NEVER change "text" content or "id"
- For Chinese text: use "Noto Serif SC", "Noto Sans SC", or "Source Han Serif"
- Return { "layers": [ { "id": "...", "textData": {...}, "x": ..., "y": ..., "width": ..., "height": ... }, ... ] }`;

  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    const parsed: { layers: PosterLayer[] } = JSON.parse(text);
    const improved: PosterLayer[] = Array.isArray(parsed.layers) ? parsed.layers : [];

    const mergedLayers = (layers as PosterLayer[]).map((l) => {
      // Never touch locked layers
      if (lockedLayers?.includes(l.id)) return l;
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
