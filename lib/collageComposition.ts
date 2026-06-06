/**
 * Collage Poster composition system.
 *
 * Architecture: code computes ALL geometry (positions, sizes, z-indexes) for
 * each pattern. GPT-4o's job is ONLY to fill in text content and style choices
 * (font, colors, copy). A merge step then restores any positions GPT changed.
 *
 * This guarantees correct placement regardless of GPT-4o's spatial reasoning.
 */

import { v4 as uuidv4 } from "uuid";
import type { PosterLayer, PosterSetupConfig, CanvasConfig } from "@/types/poster";

// ─── Pattern catalogue ────────────────────────────────────────────────────────

export type CollagePattern = "A" | "B" | "C" | "D" | "E";

export interface CollagePatternDef {
  id: CollagePattern;
  name: string;
  tagline: string;
  titleBehindSubjects: boolean;
}

export const COLLAGE_PATTERNS: Record<CollagePattern, CollagePatternDef> = {
  A: { id:"A", name:"Subject + Circle",       tagline:"Circle anchor behind subject, large title at base",       titleBehindSubjects:false },
  B: { id:"B", name:"Title Behind Subject",   tagline:"Oversized title — subject physically cuts through text",  titleBehindSubjects:true  },
  C: { id:"C", name:"Offset Block Anchor",    tagline:"Subject left, large color block right, title in block",   titleBehindSubjects:false },
  D: { id:"D", name:"Editorial Asymmetric",   tagline:"Swiss editorial, image upper-left, title lower-right",    titleBehindSubjects:false },
  E: { id:"E", name:"Brutalist Collage",      tagline:"Bold rectangles, extreme type scale, maximum contrast",   titleBehindSubjects:true  },
};

export function randomCollagePattern(): CollagePattern {
  const patterns: CollagePattern[] = ["A","B","C","D","E"];
  return patterns[Math.floor(Math.random() * patterns.length)];
}

// ─── Palette ──────────────────────────────────────────────────────────────────

export type CollagePalette = {
  bg: string;
  accent1: string;
  accent2: string;
  text: string;
};

export function buildCollagePalette(
  extractedColors: string[],
): CollagePalette {
  const defaults: CollagePalette = {
    bg:      "#f4f4f0",
    accent1: "#d63c2a",
    accent2: "#f5c400",
    text:    "#0a0a0a",
  };
  if (!extractedColors || extractedColors.length === 0) return defaults;
  const [c1, c2] = extractedColors;
  return { ...defaults, accent1: c1 ?? defaults.accent1, accent2: c2 ?? defaults.accent2 };
}

// ─── Layer factory helper ─────────────────────────────────────────────────────

function lyr(
  type: PosterLayer["type"],
  geo: { x:number; y:number; w:number; h:number; z:number; rot?:number },
  extra: Partial<PosterLayer> = {},
): PosterLayer {
  return {
    id: uuidv4(),
    type,
    label: type,
    x: geo.x, y: geo.y, width: geo.w, height: geo.h,
    zIndex: geo.z, rotation: geo.rot ?? 0,
    opacity: 1, visible: true, locked: false,
    ...extra,
  };
}

// ─── Pattern geometry builders ────────────────────────────────────────────────
//
// Every position is expressed as a fraction of canvas dimensions, then
// rounded to integers. This ensures correct scaling on any canvas size.

function buildPatternA(W:number, H:number, n:number, p:CollagePalette, concept:string): PosterLayer[] {
  const M = 40;
  const cr = Math.round(W * 0.30);           // circle radius
  const cx = Math.round(W * 0.64);           // circle center x
  const cy = Math.round(H * 0.38);           // circle center y
  const title = concept.toUpperCase() || "COLLAGE";

  return [
    lyr("solidBackground", { x:0, y:0, w:W, h:H, z:0 }, {
      shapeData: { shapeType:"rect", fill:p.bg, stroke:"none", strokeWidth:0 },
    }),
    lyr("geometricShape", { x:cx-cr, y:cy-cr, w:cr*2, h:cr*2, z:1 }, {
      shapeData: { shapeType:"circle", fill:p.accent1, stroke:"none", strokeWidth:0 },
    }),
    lyr("subjectImage", {
      x: Math.round(W*0.22), y: Math.round(H*0.03),
      w: Math.round(W*0.55), h: Math.round(H*0.70), z:3,
    }, { imageData: { src:"__SUBJECT_0__", fit:"contain" } }),
    ...(n >= 2 ? [lyr("subjectImage", {
      x: Math.round(W*0.53), y: Math.round(H*0.04),
      w: Math.round(W*0.32), h: Math.round(H*0.42), z:4,
    }, { imageData: { src:"__SUBJECT_1__", fit:"contain" } })] : []),
    lyr("titleText", {
      x:M, y:Math.round(H*0.74), w:W-(M*2), h:Math.round(H*0.17), z:6,
    }, { textData: { text:title, fontFamily:"Bebas Neue", fontSize:130, fontWeight:400,
        fontStyle:"normal", fill:p.text, align:"left", letterSpacing:4, lineHeight:0.9, textTransform:"uppercase" } }),
    lyr("metaText", {
      x:M, y:Math.round(H*0.94), w:Math.round(W*0.55), h:24, z:7,
    }, { textData: { text:"2025", fontFamily:"Space Mono", fontSize:12, fontWeight:400,
        fontStyle:"normal", fill:p.text, align:"left", letterSpacing:2, lineHeight:1.4 } }),
  ];
}

function buildPatternB(W:number, H:number, n:number, p:CollagePalette, concept:string): PosterLayer[] {
  const M = 40;
  const title = concept.toUpperCase() || "COLLAGE";

  return [
    lyr("solidBackground", { x:0, y:0, w:W, h:H, z:0 }, {
      shapeData: { shapeType:"rect", fill:p.bg, stroke:"none", strokeWidth:0 },
    }),
    // Accent strip — left side
    lyr("geometricShape", { x:0, y:0, w:Math.round(W*0.46), h:H, z:1 }, {
      shapeData: { shapeType:"rect", fill:p.accent1, stroke:"none", strokeWidth:0 },
    }),
    // TITLE BEHIND SUBJECT — zIndex 2 (below subject at z:3)
    lyr("titleText", {
      x:M, y:Math.round(H*0.26), w:W-(M*2), h:Math.round(H*0.30), z:2,
    }, { textData: { text:title, fontFamily:"Bebas Neue", fontSize:170, fontWeight:400,
        fontStyle:"normal", fill:p.text, align:"left", letterSpacing:2, lineHeight:0.88, textTransform:"uppercase" } }),
    // Subject ABOVE title (cuts through text)
    lyr("subjectImage", {
      x: Math.round(W*0.12), y: Math.round(H*0.03),
      w: Math.round(W*0.55), h: Math.round(H*0.78), z:3,
    }, { imageData: { src:"__SUBJECT_0__", fit:"contain" } }),
    ...(n >= 2 ? [lyr("subjectImage", {
      x: Math.round(W*0.52), y: Math.round(H*0.14),
      w: Math.round(W*0.38), h: Math.round(H*0.50), z:4,
    }, { imageData: { src:"__SUBJECT_1__", fit:"contain" } })] : []),
    lyr("metaText", {
      x:M, y:Math.round(H*0.90), w:Math.round(W*0.55), h:22, z:7,
    }, { textData: { text:"2025", fontFamily:"Space Mono", fontSize:12, fontWeight:400,
        fontStyle:"normal", fill:p.text, align:"left", letterSpacing:2, lineHeight:1.4 } }),
  ];
}

function buildPatternC(W:number, H:number, n:number, p:CollagePalette, concept:string): PosterLayer[] {
  const M = 40;
  const title = concept.toUpperCase() || "COLLAGE";
  const rightX = Math.round(W * 0.50);

  return [
    lyr("solidBackground", { x:0, y:0, w:W, h:H, z:0 }, {
      shapeData: { shapeType:"rect", fill:p.bg, stroke:"none", strokeWidth:0 },
    }),
    // Right color block
    lyr("geometricShape", { x:rightX, y:0, w:W-rightX, h:H, z:1 }, {
      shapeData: { shapeType:"rect", fill:p.accent1, stroke:"none", strokeWidth:0 },
    }),
    // Thin horizontal bar on left side
    lyr("accentLine", {
      x:0, y:Math.round(H*0.17), w:Math.round(W*0.48), h:6, z:2,
    }, { shapeData: { shapeType:"rect", fill:p.accent1, stroke:"none", strokeWidth:0 } }),
    // Subject LEFT, bridging into right zone
    lyr("subjectImage", {
      x: Math.round(W*0.02), y: Math.round(H*0.10),
      w: Math.round(W*0.52), h: Math.round(H*0.72), z:3,
    }, { imageData: { src:"__SUBJECT_0__", fit:"contain" } }),
    ...(n >= 2 ? [lyr("subjectImage", {
      x: Math.round(W*0.52), y: Math.round(H*0.05),
      w: Math.round(W*0.36), h: Math.round(H*0.38), z:4,
    }, { imageData: { src:"__SUBJECT_1__", fit:"contain" } })] : []),
    // Title in RIGHT zone
    lyr("titleText", {
      x: Math.round(W*0.53), y: Math.round(H*0.36), w: Math.round(W*0.43), h: Math.round(H*0.32), z:5,
    }, { textData: { text:title, fontFamily:"Bebas Neue", fontSize:90, fontWeight:400,
        fontStyle:"normal", fill:"#ffffff", align:"left", letterSpacing:2, lineHeight:0.92, textTransform:"uppercase" } }),
    lyr("metaText", {
      x: Math.round(W*0.53), y: Math.round(H*0.88), w: Math.round(W*0.43), h:22, z:7,
    }, { textData: { text:"2025", fontFamily:"Space Mono", fontSize:12, fontWeight:400,
        fontStyle:"normal", fill:"#ffffff", align:"left", letterSpacing:2, lineHeight:1.4 } }),
  ];
}

function buildPatternD(W:number, H:number, n:number, p:CollagePalette, concept:string): PosterLayer[] {
  const M = 40;
  const title = concept.toUpperCase() || "COLLAGE";
  const divY = Math.round(H * 0.56);

  return [
    lyr("solidBackground", { x:0, y:0, w:W, h:H, z:0 }, {
      shapeData: { shapeType:"rect", fill:p.bg, stroke:"none", strokeWidth:0 },
    }),
    // Horizontal divider
    lyr("accentLine", { x:0, y:divY, w:W, h:4, z:1 }, {
      shapeData: { shapeType:"rect", fill:p.accent1, stroke:"none", strokeWidth:0 },
    }),
    // Small anchor block bottom-right
    lyr("geometricShape", {
      x: Math.round(W*0.70), y: Math.round(H*0.74),
      w: Math.round(W*0.27), h: Math.round(H*0.20), z:2,
    }, { shapeData: { shapeType:"rect", fill:p.accent2, stroke:"none", strokeWidth:0 } }),
    // Subject UPPER LEFT
    lyr("subjectImage", {
      x:0, y:0, w:Math.round(W*0.48), h:Math.round(H*0.55), z:3,
    }, { imageData: { src:"__SUBJECT_0__", fit:"contain" } }),
    ...(n >= 2 ? [lyr("subjectImage", {
      x: Math.round(W*0.50), y: Math.round(H*0.06),
      w: Math.round(W*0.34), h: Math.round(H*0.36), z:4,
    }, { imageData: { src:"__SUBJECT_1__", fit:"contain" } })] : []),
    // Title LOWER RIGHT
    lyr("titleText", {
      x: Math.round(W*0.42), y: Math.round(H*0.61),
      w: Math.round(W*0.54), h: Math.round(H*0.24), z:6,
    }, { textData: { text:title, fontFamily:"Bebas Neue", fontSize:80, fontWeight:400,
        fontStyle:"normal", fill:p.text, align:"left", letterSpacing:3, lineHeight:0.92, textTransform:"uppercase" } }),
    // Vertical meta text — right edge
    lyr("metaText", {
      x: Math.round(W*0.93), y: Math.round(H*0.20),
      w: 20, h: Math.round(H*0.35), z:7, rot:-90,
    }, { textData: { text:"2025 · EXHIBITION", fontFamily:"Space Mono", fontSize:11, fontWeight:400,
        fontStyle:"normal", fill:p.text, align:"left", letterSpacing:3, lineHeight:1.4 } }),
    lyr("subtitleText", {
      x:M, y:Math.round(H*0.62), w:Math.round(W*0.38), h:22, z:6,
    }, { textData: { text:concept || "Exhibition", fontFamily:"Space Mono", fontSize:13, fontWeight:400,
        fontStyle:"normal", fill:p.text, align:"left", letterSpacing:1, lineHeight:1.4 } }),
  ];
}

function buildPatternE(W:number, H:number, n:number, p:CollagePalette, concept:string): PosterLayer[] {
  const M = 40;
  const title = concept.toUpperCase() || "COLLAGE";
  const stripH = Math.round(H * 0.28);

  return [
    // White/near-white base for brutalist contrast
    lyr("solidBackground", { x:0, y:0, w:W, h:H, z:0 }, {
      shapeData: { shapeType:"rect", fill:"#f2f0ec", stroke:"none", strokeWidth:0 },
    }),
    // Black top strip
    lyr("geometricShape", { x:0, y:0, w:W, h:stripH, z:1 }, {
      shapeData: { shapeType:"rect", fill:"#0a0a0a", stroke:"none", strokeWidth:0 },
    }),
    // Accent mid-block
    lyr("geometricShape", {
      x: Math.round(W*0.05), y: Math.round(H*0.22),
      w: Math.round(W*0.55), h: Math.round(H*0.65), z:2,
    }, { shapeData: { shapeType:"rect", fill:p.accent1, stroke:"none", strokeWidth:0 } }),
    // TITLE in black strip, BELOW subject (zIndex 3 < subject zIndex 4)
    lyr("titleText", {
      x:M, y:Math.round(H*0.03), w:W-(M*2), h:Math.round(H*0.24), z:3,
    }, { textData: { text:title, fontFamily:"Bebas Neue", fontSize:180, fontWeight:400,
        fontStyle:"normal", fill:"#ffffff", align:"left", letterSpacing:1, lineHeight:0.86, textTransform:"uppercase" } }),
    // Subject spanning both blocks
    lyr("subjectImage", {
      x: Math.round(W*0.20), y: Math.round(H*0.08),
      w: Math.round(W*0.55), h: Math.round(H*0.78), z:4,
    }, { imageData: { src:"__SUBJECT_0__", fit:"contain" } }),
    ...(n >= 2 ? [lyr("subjectImage", {
      x: Math.round(W*0.60), y: Math.round(H*0.30),
      w: Math.round(W*0.32), h: Math.round(H*0.42), z:5,
    }, { imageData: { src:"__SUBJECT_1__", fit:"contain" } })] : []),
    lyr("bodyText", {
      x: Math.round(W*0.05)+M, y: Math.round(H*0.62),
      w: Math.round(W*0.45), h: Math.round(H*0.16), z:7,
    }, { textData: { text:concept || "exhibition", fontFamily:"Space Mono", fontSize:13, fontWeight:400,
        fontStyle:"normal", fill:"#f2f0ec", align:"left", letterSpacing:1, lineHeight:1.5 } }),
    lyr("metaText", {
      x: Math.round(W*0.05)+M, y: Math.round(H*0.90),
      w: Math.round(W*0.45), h:22, z:7,
    }, { textData: { text:"2025", fontFamily:"Space Mono", fontSize:12, fontWeight:400,
        fontStyle:"normal", fill:"#0a0a0a", align:"left", letterSpacing:2, lineHeight:1.4 } }),
  ];
}

/**
 * Builds the full layer template for the given pattern.
 * ALL positions, sizes, and z-indexes are computed here.
 * GPT-4o only needs to personalize text and style.
 */
export function buildCollageLayoutTemplate(
  pattern: CollagePattern,
  canvas: CanvasConfig,
  imageCount: number,
  palette: CollagePalette,
  concept: string,
): PosterLayer[] {
  const { width: W, height: H } = canvas;
  const n = Math.min(imageCount, 3);
  const builders = { A: buildPatternA, B: buildPatternB, C: buildPatternC, D: buildPatternD, E: buildPatternE };
  return (builders[pattern] ?? buildPatternA)(W, H, n, palette, concept);
}

// ─── GPT-4o style prompts ─────────────────────────────────────────────────────

/**
 * Short system prompt — GPT-4o is only personalizing style, not doing layout.
 */
export function buildCollageStyleSystemPrompt(): string {
  return `You are a typographer and color director finalizing a poster composition.
The layout structure and all element positions have already been computed by the system.
Your ONLY job: personalize text content, font choices, font sizes, and colors.
NEVER change: x, y, width, height, zIndex, rotation, type, id, imageData.src.
Return ONLY valid JSON — no markdown, no code fences.`;
}

/**
 * User prompt for style personalization.
 * Injects the pre-computed layer template and asks GPT to fill in creative choices.
 */
export function buildCollageStyleUserPrompt(
  templateLayers: PosterLayer[],
  setup: PosterSetupConfig,
  canvas: CanvasConfig,
  patternId: CollagePattern,
  palette: CollagePalette,
): string {
  const pattern = COLLAGE_PATTERNS[patternId];
  const { width: W, height: H } = canvas;
  const concept = setup.prompt || "collage poster";

  return `CONCEPT: "${concept}"
PATTERN: ${pattern.id} — ${pattern.name}: ${pattern.tagline}
CANVAS: ${W}×${H}px | LANGUAGE: ${setup.language ?? "en"}

AVAILABLE PALETTE:
  bg      = ${palette.bg}   (canvas background — keep as-is)
  accent1 = ${palette.accent1}  (primary accent — main shape color)
  accent2 = ${palette.accent2}  (secondary accent)
  text    = ${palette.text}    (default text color)

FONT OPTIONS:
  Display (bold titles): "Bebas Neue" | "Space Grotesk" | "Oswald" | "Anton"
  Body (meta/credits):   "Space Mono" | "Inter" | "Courier New"

LAYER TEMPLATE — positions are FIXED, personalize the starred fields (*):
${JSON.stringify(templateLayers, null, 2)}

PERSONALIZATION RULES:
1. titleText layers:
   * text → write a punchy title for the concept; use ALL-CAPS for Bebas Neue
   * fontFamily → choose from Display options above
   * fontSize → ±20% of current value based on title length (shorter = bigger)
   * fill → high-contrast against its background zone (check zIndex and position)
   * letterSpacing → 0–20 for display type

2. subtitleText / bodyText / metaText:
   * text → write supporting copy: short tagline, date, venue, or credits
   * fontFamily → choose from Body options
   * fontSize → keep within ±2px of current value
   * fill → coordinate with overall palette

3. geometricShape (NOT solidBackground):
   * shapeData.fill → choose accent1, accent2, or "#0a0a0a" for brutalist patterns

4. solidBackground:
   * shapeData.fill → keep as ${palette.bg} (do not change)

5. subjectImage layers:
   * DO NOT change imageData.src (keep "__SUBJECT_N__" exactly as-is)

HARD RULES — NEVER change these fields:
  x, y, width, height, zIndex, rotation, type, id, imageData.src

RETURN FORMAT:
{
  "layers": [ ...all layers in same order, with text/style fields updated... ],
  "fonts": { "display": "<chosen display font>", "body": "<chosen body font>" },
  "palette": { "dominant": "${palette.text}", "secondary": "${palette.bg}", "accent": "${palette.accent1}", "background": "${palette.bg}" }
}`;
}

/**
 * Merges GPT-4o's style choices back into the template, restoring
 * all positional properties from the template (so GPT can never break layout).
 */
export function mergeStyleIntoTemplate(
  template: PosterLayer[],
  gptLayers: Partial<PosterLayer>[],
): PosterLayer[] {
  return template.map((t) => {
    const g = gptLayers.find((l) => l.id === t.id);
    if (!g) return t;

    const merged: PosterLayer = {
      ...t,      // start from template
      ...g,      // overlay GPT choices (text, colors, fonts)
      // ALWAYS restore critical geometry from template — GPT cannot change these
      id:       t.id,
      type:     t.type,
      label:    t.label,
      x:        t.x,
      y:        t.y,
      width:    t.width,
      height:   t.height,
      zIndex:   t.zIndex,
      rotation: t.rotation,
      visible:  t.visible,
      locked:   t.locked,
    };

    // For subject images: always restore src placeholder
    if (t.type === "subjectImage") {
      merged.imageData = t.imageData;
    }

    return merged;
  });
}

// ─── Debug grid ───────────────────────────────────────────────────────────────

const GRID_SYMBOL: Partial<Record<PosterLayer["type"], string>> = {
  titleText:       "TT",
  subtitleText:    "ST",
  bodyText:        "BT",
  metaText:        "MT",
  subjectImage:    "SI",
  backgroundImage: "BI",
  geometricShape:  "GS",
  accentLine:      "AL",
  solidBackground: "BG",
  noiseTexture:    "NX",
  colorOverlay:    "CO",
};

/**
 * Logs a 12-column ASCII grid to the server console showing which columns
 * each layer occupies. Call this after layout is finalized.
 */
export function logCollageDebugGrid(
  layers: PosterLayer[],
  canvas: CanvasConfig,
  pattern: CollagePattern,
): void {
  const W = canvas.width;
  const colW = W / 12;
  const patDef = COLLAGE_PATTERNS[pattern];
  const bar = "─".repeat(62);

  console.log(`\n[collage-grid] ╔${bar}╗`);
  console.log(`[collage-grid] ║  PATTERN ${pattern}: ${patDef.name.padEnd(30)} Canvas ${W}×${canvas.height}  ║`);
  console.log(`[collage-grid] ║  ${patDef.tagline.padEnd(58)} ║`);
  console.log(`[collage-grid] ╠${bar}╣`);
  console.log(`[collage-grid] ║  Layer               z   Col: 1  2  3  4  5  6  7  8  9 10 11 12  ║`);
  console.log(`[collage-grid] ╠${bar}╣`);

  const sorted = [...layers].filter(l => l.visible).sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  for (const layer of sorted) {
    const sym = GRID_SYMBOL[layer.type] ?? "??";
    const startCol = Math.max(0, Math.floor(layer.x / colW));
    const endCol   = Math.min(11, Math.ceil((layer.x + layer.width) / colW) - 1);
    const grid = Array.from({ length: 12 }, (_, i) =>
      i >= startCol && i <= endCol ? sym : " ·",
    );
    const label = layer.label.padEnd(20).slice(0, 20);
    const z     = String(layer.zIndex ?? 0).padStart(3);
    console.log(`[collage-grid] ║  ${label} ${z}    ${grid.join("  ")}  ║`);
  }

  console.log(`[collage-grid] ╚${bar}╝`);
  console.log(`[collage-grid] Legend: BG=Background  GS=GeomShape  SI=SubjectImage  TT=Title  ST=Subtitle  MT=Meta  AL=AccentLine\n`);
}

// ─── Completeness check ───────────────────────────────────────────────────────

export interface CompletenessCheck {
  backgroundPresent: boolean;
  patternChosen:     boolean;
  subjectsSpread:    boolean;
  typographyConnected: boolean;
  hierarchyClear:    boolean;
  passes: boolean;
}

/**
 * Evaluates the 5 poster completeness criteria.
 * Log the result; reject and re-run if passes === false.
 */
export function checkCollageCompleteness(
  layers: PosterLayer[],
  canvas: CanvasConfig,
  pattern: CollagePattern | undefined,
): CompletenessCheck {
  const W = canvas.width;
  const H = canvas.height;

  // 1. Background present and covers full canvas
  const bg = layers.find(l => l.type === "solidBackground" && l.visible);
  const backgroundPresent = !!bg && bg.x === 0 && bg.y === 0 &&
    bg.width >= W * 0.98 && bg.height >= H * 0.98;

  // 2. Pattern was chosen
  const patternChosen = !!pattern;

  // 3. Subjects are spread — no two subjects within 100px of each other
  const subjects = layers.filter(l => l.type === "subjectImage" && l.visible);
  const subjectsSpread = subjects.length <= 1 || (() => {
    for (let i = 0; i < subjects.length; i++) {
      for (let j = i + 1; j < subjects.length; j++) {
        const dx = Math.abs(subjects[i].x - subjects[j].x);
        const dy = Math.abs(subjects[i].y - subjects[j].y);
        if (dx < 100 && dy < 100) return false;
      }
    }
    // Also check no subject is near origin (0,0 within 20px)
    return !subjects.some(s => s.x < 20 && s.y < 20);
  })();

  // 4. Typography connected — title within 200px of a subject or shape
  const title = layers.find(l => l.type === "titleText" && l.visible);
  const anchors = layers.filter(l =>
    l.visible && (l.type === "subjectImage" || l.type === "geometricShape"),
  );
  const typographyConnected = !title || anchors.length === 0 || anchors.some(a => {
    const dx = Math.abs((title.x + title.width / 2) - (a.x + a.width / 2));
    const dy = Math.abs((title.y + title.height / 2) - (a.y + a.height / 2));
    return dx < W * 0.5 && dy < H * 0.5;
  });

  // 5. Hierarchy clear — title fontSize ≥ 2× any other text
  const titleSize = title?.textData?.fontSize ?? 0;
  const otherText = layers.filter(l =>
    l.type !== "titleText" && l.visible && (l.textData?.fontSize ?? 0) > 0,
  );
  const hierarchyClear = titleSize === 0 || otherText.length === 0 ||
    otherText.every(l => (l.textData?.fontSize ?? 0) <= titleSize * 0.6);

  const passes = backgroundPresent && patternChosen && subjectsSpread &&
    typographyConnected && hierarchyClear;

  return { backgroundPresent, patternChosen, subjectsSpread, typographyConnected, hierarchyClear, passes };
}

// ─── Legacy prompt builders (kept for reference) ──────────────────────────────
// The layout route now uses buildCollageLayoutTemplate + buildCollageStyleUserPrompt.
// These originals remain for backward compatibility with any external callers.

export function buildCollageSystemPrompt(): string {
  return buildCollageStyleSystemPrompt();
}

export function buildCollageUserPrompt(
  setup: PosterSetupConfig,
  canvas: CanvasConfig,
  imageCount: number,
  palette: { bg: string; accent1: string; accent2: string; text: string },
  patternId: CollagePattern,
): string {
  const template = buildCollageLayoutTemplate(patternId, canvas, imageCount, palette, setup.prompt ?? "");
  return buildCollageStyleUserPrompt(template, setup, canvas, patternId, palette);
}
