/**
 * Collage Poster composition system.
 *
 * Provides patterns, prompts, and helpers for the composition-first
 * Collage Poster style. This style uses uploaded cutout subjects
 * (no AI-generated backgrounds), flat geometric shapes, and integrated typography.
 */

import type { PosterSetupConfig, CanvasConfig } from "@/types/poster";

// ─── Pattern definitions ──────────────────────────────────────────────────────

export type CollagePattern = "A" | "B" | "C" | "D" | "E";

export interface CollagePatternDef {
  id: CollagePattern;
  name: string;
  tagline: string;
  /** Whether the title z-index goes below subjects (subject cuts through text) */
  titleBehindSubjects: boolean;
  allowedShapes: ("rect" | "circle" | "accentLine")[];
  /** Injected verbatim into the GPT-4o user prompt */
  instructions: string;
}

export const COLLAGE_PATTERNS: Record<CollagePattern, CollagePatternDef> = {

  A: {
    id: "A",
    name: "Subject + Circle",
    tagline: "Large geometric circle behind subject, display title overlapping",
    titleBehindSubjects: false,
    allowedShapes: ["circle"],
    instructions: `
PATTERN A — Subject + Circle:

Shapes:
  1. Large CIRCLE (geometricShape, shapeType:"circle", not shapeType:"rect"):
     - Radius: 28-38% of canvas width
     - Center: right-center zone (cx ≈ 65% W, cy ≈ 40% H) — adjust per concept
     - Fill: accent color 1 (strong, non-white, non-black)
     - zIndex: 1

Subjects:
  2. Subject_0: centered over or slightly overlapping the circle edge
     - Size: ~50-65% canvas height
     - Position: circle center ±10%
     - zIndex: 3

Typography:
  3. Title: VERY LARGE (fontSize 110-170px), full canvas width
     - Aligned LEFT or spanning full canvas
     - zIndex: 6 (above subjects)
     - Position: intersects or aligns with circle/subject boundary (y: 70-85% H)

  4. metaText: small (fontSize 11-14px), bottom-left or vertical right edge
     - zIndex: 7

Key requirement: circle edge must be visible OUTSIDE the subject bounding box.
The subject overlaps the circle but the arc remains visible around it.
`,
  },

  B: {
    id: "B",
    name: "Title Behind Subject",
    tagline: "Oversized title — subject cuts through typography",
    titleBehindSubjects: true,
    allowedShapes: ["rect"],
    instructions: `
PATTERN B — Title Behind Subject (subject cuts through text):

Shapes:
  1. Accent RECT (left or right strip):
     - Width: 40-55% canvas width
     - Height: full canvas height
     - Fill: accent color (strong color — red, orange, cyan, etc.)
     - zIndex: 1

Typography:
  2. Title: OVERSIZED (fontSize 150-200px), very large
     - Spans most or full canvas width
     - zIndex: 2 ← BELOW subjects (subject will physically cover it)
     - Position: center of canvas or top-center
     - This is intentional: subject cuts through the title

Subjects:
  3. Subject_0: ABOVE the title
     - zIndex: 3 — sits ON TOP of title text
     - The subject physically covers part of the oversized title
     - Size: 55-70% canvas height, centered or offset
     - This occlusion is the core design intent of Pattern B

  4. If subject_1 exists: smaller, offset to opposite side, zIndex: 4

Small text:
  5. Subtitle: small (fontSize 14-18px), aligned to subject edge
     - zIndex: 7
`,
  },

  C: {
    id: "C",
    name: "Offset Block Anchor",
    tagline: "Image offset left, large colored rectangle right, title in rect zone",
    titleBehindSubjects: false,
    allowedShapes: ["rect"],
    instructions: `
PATTERN C — Offset Block + Shape Anchor:

Shapes:
  1. Large accent RECT occupying RIGHT half:
     - x: 50% W, y: 0, width: 50% W, height: 100% H
     - Fill: accent color 1
     - zIndex: 1

  2. Optional thin accent RECT (horizontal bar):
     - y: 15-20% H, x: 0, width: 45% W, height: 6-10px
     - Fill: accent color 1
     - zIndex: 2

Subjects:
  3. Subject_0: LEFT half of canvas
     - x: 2-8% W, y: 10-20% H
     - Width: 45-55% canvas width
     - zIndex: 3
     - Overlaps slightly into the right accent rect (subject bridges the boundary)

  4. If subject_1: smaller, upper right corner
     - zIndex: 4

Typography:
  5. Title: placed in the RIGHT COLORED ZONE
     - x: 52-55% W, y: 30-50% H
     - fontSize: 70-110px
     - Fill: white or contrasting color against accent rect
     - Aligned LEFT within the rect zone
     - zIndex: 5

  6. metaText: small, bottom of right rect, fill white or contrast
     - zIndex: 7
`,
  },

  D: {
    id: "D",
    name: "Editorial Asymmetric",
    tagline: "Swiss editorial, image in quadrant, title in diagonal relationship",
    titleBehindSubjects: false,
    allowedShapes: ["rect", "accentLine"],
    instructions: `
PATTERN D — Editorial Asymmetric (Swiss/editorial style):

Shapes:
  1. Thin horizontal ACCENT LINE (accentLine):
     - y: 55-60% H (visual divider), x: 0, width: full canvas
     - Fill/stroke: accent color 1
     - zIndex: 1

  2. Optional small accent RECT (bottom-right anchor):
     - x: 70% W, y: 75% H, width: 28% W, height: 20% H
     - Fill: accent color 2
     - zIndex: 2

Subjects:
  3. Subject_0: UPPER LEFT quadrant
     - x: 0, y: 0
     - Width: 45-55% canvas width, Height: 50-55% canvas height
     - zIndex: 3

Typography:
  4. Title: LOWER RIGHT area
     - x: 40-50% W, y: 60-75% H
     - fontSize: 60-90px
     - Spatial relationship: title starts where subject ends horizontally
     - zIndex: 6

  5. metaText: vertical (writingMode: "vertical") along RIGHT edge
     - x: 92-95% W, y: 20-25% H
     - zIndex: 7

  6. Small descriptive body text BELOW the accent line, left-aligned
     - zIndex: 7

The composition should feel deliberate: text and image in balanced tension.
`,
  },

  E: {
    id: "E",
    name: "Brutalist Collage",
    tagline: "Bold rectangles, extreme type scale, high contrast black+accent",
    titleBehindSubjects: true,
    allowedShapes: ["rect", "rect"],
    instructions: `
PATTERN E — Brutalist Collage (high contrast, raw, extreme scale):

Palette for this pattern:
  - Background: white or near-white
  - Shape 1: black (#0a0a0a)
  - Shape 2: strong accent (red, orange, or cyan)
  - Text: black or white (high contrast)

Shapes:
  1. Large BLACK RECT:
     - Full canvas width, top 25-30% of canvas height (horizontal strip)
     - Fill: "#0a0a0a"
     - zIndex: 1

  2. Accent RECT:
     - Width: 40-55% canvas width, height: 60-70% canvas height
     - Positioned mid-left or mid-right
     - Fill: strong accent color
     - zIndex: 2

Subjects:
  3. Subject_0: overlapping BOTH rectangles (bridges them)
     - Position: spans from rect 1 into rect 2 zone
     - Size: 50-70% canvas height
     - zIndex: 4

Typography:
  4. Title: ENORMOUS (fontSize 160-200px)
     - zIndex: 3 ← BELOW subject_0 (subject cuts through it)
     - Positioned overlapping rect 1 (black strip) zone
     - Fill: white (contrasts against black rect)
     - The subject covering part of the title IS the design

  5. Small body text blocks: 2-3 instances
     - fontSize 10-14px
     - Fill: black
     - Positioned in lower zone, creating density contrast
     - zIndex: 7

Key feeling: raw, unpolished, everything pushed to extremes.
`,
  },
};

export function randomCollagePattern(): CollagePattern {
  const patterns: CollagePattern[] = ["A", "B", "C", "D", "E"];
  return patterns[Math.floor(Math.random() * patterns.length)];
}

// ─── System prompt ────────────────────────────────────────────────────────────

export function buildCollageSystemPrompt(): string {
  return `You are a Creative Director composing a COLLAGE POSTER.

This is COMPOSITION-FIRST design, not image-generation-first.
The uploaded cutout photographs are the primary visual content — you arrange them.

ABSOLUTE RULES:

1. NO Flux background generation. Set fluxPrompt to "" (empty string).
   The background is solidBackground only — a flat solid color.

2. Uploaded subjects are provided as placeholder src values:
   "__SUBJECT_0__", "__SUBJECT_1__", "__SUBJECT_2__"
   These are grayscale photographs with transparent backgrounds.
   DO NOT replace them. DO NOT invent other subjects.
   Use them exactly as-is.

3. SHAPES: flat solid fill ONLY.
   - Allowed: rect, circle (shapeType in shapeData)
   - Allowed layer types: geometricShape, accentLine, solidBackground
   - FORBIDDEN: gradients, shadows, glows, bevels, colorOverlay, gradientLayer
   - All shapes must use shapeData.fill with a solid hex color

4. LAYER ORDER (z-index):
   - solidBackground: zIndex 0
   - geometric shapes: zIndex 1-2
   - subject images: zIndex 3-5 (ABOVE shapes)
   - title text: zIndex 2 (below subjects) for Pattern B/E, zIndex 6 (above) for A/C/D
   - other text: zIndex 7+

5. SHAPE-SUBJECT OVERLAP RULE:
   - Each geometric shape must be 30-80% visible after subjects are placed on top
   - Position subjects to overlap shapes — this creates the collage effect
   - The subject must NOT completely hide the shape

6. TYPOGRAPHY INTEGRATION (mandatory):
   - Title MUST have a direct spatial relationship to the composition
   - The title must either: align with shape edges, overlap a subject, or follow an image boundary
   - NO floating text disconnected from imagery

7. PALETTE: flat solid colors only, maximum 3 accent colors

8. Return ONLY valid JSON. No markdown. No code fences.`;
}

// ─── User prompt ──────────────────────────────────────────────────────────────

export function buildCollageUserPrompt(
  setup: PosterSetupConfig,
  canvas: CanvasConfig,
  imageCount: number,
  palette: { bg: string; accent1: string; accent2: string; text: string },
  patternId: CollagePattern,
): string {
  const W = canvas.width;
  const H = canvas.height;
  const pattern = COLLAGE_PATTERNS[patternId];

  const subjectLines = Array.from(
    { length: imageCount },
    (_, i) =>
      `  Subject ${i}: type="subjectImage", imageData.src="__SUBJECT_${i}__", imageData.fit="contain"`,
  ).join("\n");

  return `Compose a COLLAGE POSTER.

CANVAS: ${W} × ${H}px
SAFE MARGINS: 40px all sides
USER CONCEPT: "${setup.prompt || "collage poster"}"
LANGUAGE: ${setup.language ?? "en"}

UPLOADED SUBJECTS (${imageCount} grayscale cutout image(s)):
${subjectLines}
These are the PRIMARY visual content. Do NOT replace them.

COMPOSITION PATTERN: ${pattern.name}
Pattern tagline: ${pattern.tagline}
${pattern.instructions}

PALETTE:
  Background: ${palette.bg}
  Accent 1 (primary — for main shape): ${palette.accent1}
  Accent 2 (secondary): ${palette.accent2}
  Text: ${palette.text}

LAYER TYPE RULES:
  solidBackground → shapeData.fill = background color, x:0, y:0, w:${W}, h:${H}, zIndex:0
  geometricShape  → shapeData.fill = accent color, shapeData.stroke:"none", flat color
  accentLine      → shapeData.shapeType:"line", shapeData.stroke = accent color
  subjectImage    → imageData.src = "__SUBJECT_N__", imageData.fit:"contain"
  titleText       → textData with fontFamily, fontSize, fill, align
  subtitleText / metaText → smaller text elements

TYPOGRAPHY REQUIREMENTS:
  - Title font: "Bebas Neue" (display) OR "Space Grotesk" (weight 700)
  - Body font: "Space Mono" OR "Inter" (weight 400)
  - Title fontSize: ${pattern.titleBehindSubjects ? "150-200" : "80-140"}px
  - ${pattern.titleBehindSubjects ? "Title zIndex MUST BE BELOW subjects (subjects cut through title)" : "Title zIndex above subjects"}
  - Title must align with or overlap at least one shape or subject boundary

USER COPY TO USE:
  - Title: based on concept "${setup.prompt || "COLLAGE"}" — all caps if Bebas Neue
  - Use short, punchy words for brutalist/editorial feel

FINAL CHECK BEFORE RETURNING:
  1. fluxPrompt = "" (empty — no image generation)
  2. All subject src values are "__SUBJECT_N__" placeholders
  3. Shapes use shapeData with flat fill, NO gradientData
  4. Every text layer is within safe margins (x≥40, y≥40, x+w≤${W - 40}, y+h≤${H - 40})
  5. No layer extends outside canvas [0,0,${W},${H}]
  6. Title has a spatial relationship to the composition

Return ONLY the JSON poster layout (same schema as normal posters).`;
}

// ─── Palette extraction from image data ───────────────────────────────────────

/**
 * Extracts a simple representative palette from an array of palette colors.
 * Maps to the accent1/accent2/bg/text structure needed for collage.
 */
export function buildCollagePalette(
  extractedColors: string[],
): { bg: string; accent1: string; accent2: string; text: string } {
  // Collage default: neutral bg + strong accent
  const defaults = {
    bg:      "#f4f4f0",
    accent1: "#d63c2a",
    accent2: "#f5c400",
    text:    "#0a0a0a",
  };

  if (!extractedColors || extractedColors.length === 0) return defaults;

  // Use first extracted color as accent1, second (if distinct) as accent2
  const [c1, c2] = extractedColors;
  return {
    bg:      defaults.bg,
    accent1: c1 ?? defaults.accent1,
    accent2: c2 ?? defaults.accent2,
    text:    defaults.text,
  };
}
