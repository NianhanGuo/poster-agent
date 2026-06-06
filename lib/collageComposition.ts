/**
 * Collage Poster — editorial visual composition system.
 *
 * Design philosophy: NOT a scrapbook. This is editorial poster design inspired by
 * Swiss Design, Japanese poster design, brutalist editorial, and experimental cinema.
 *
 * Architecture:
 * - detectCollagePreset() reads the concept and picks the editorial template
 * - buildCollageLayoutTemplate() computes ALL geometry from the preset
 * - GPT-4o fills in text, fonts, colors — never positions
 * - mergeStyleIntoTemplate() restores all positions after GPT responds
 */

import { v4 as uuidv4 } from "uuid";
import type { PosterLayer, PosterSetupConfig, CanvasConfig } from "@/types/poster";

// ─── Editorial preset catalogue ───────────────────────────────────────────────

export type CollagePreset =
  | "editorial-hero"    // Single dominant subject, massive title, strong hierarchy
  | "swiss-grid"        // Strict grid, bold condensed type, minimal imagery
  | "brutalist-poster"  // Maximum type scale, aggressive contrast, confrontational
  | "magazine-cover"    // Hero subject fills frame, information hierarchy
  | "experimental-film";// Dramatic placement, subject breaks frame, cinematic

/** Backward-compat alias used by existing imports */
export type CollagePattern = CollagePreset;

export interface CollagePatternDef {
  id: CollagePreset;
  name: string;
  tagline: string;
  titleBehindSubjects: boolean;
}

export const COLLAGE_PATTERNS: Record<CollagePreset, CollagePatternDef> = {
  "editorial-hero":    { id:"editorial-hero",    name:"Editorial Hero",    tagline:"Single dominant subject, massive title behind", titleBehindSubjects:true  },
  "swiss-grid":        { id:"swiss-grid",        name:"Swiss Grid",        tagline:"Strict baseline grid, bold condensed typography", titleBehindSubjects:false },
  "brutalist-poster":  { id:"brutalist-poster",  name:"Brutalist Poster",  tagline:"Oversized type, maximum contrast, aggressive",  titleBehindSubjects:true  },
  "magazine-cover":    { id:"magazine-cover",    name:"Magazine Cover",    tagline:"Hero subject fills frame, information hierarchy", titleBehindSubjects:false },
  "experimental-film": { id:"experimental-film", name:"Experimental Film", tagline:"Dramatic asymmetry, subject breaks frame",       titleBehindSubjects:true  },
};

// ─── CollagePlan — Director schema ───────────────────────────────────────────

export interface CollagePlan {
  composition_template: CollagePreset;
  hero_subject_count: 1 | 2;
  typography_system: "swiss-modern" | "neo-grotesk" | "editorial-serif" | "brutalist" | "condensed-poster" | "japanese-minimal";
  typography_primary_font: string;
  typography_secondary_font: string;
  global_texture: "paper-grain" | "newsprint" | "film-grain" | "offset-print" | "scanner-noise";
  color_scheme: "black-white-red" | "black-white-orange" | "cream-black-red" | "dark-gray-accent" | "monochrome-accent";
  accent_color: string;
  micro_information: string[];
}

// ─── Concept-driven preset detection ─────────────────────────────────────────

const PRESET_SIGNALS: [CollagePreset, RegExp][] = [
  ["brutalist-poster",  /brutal|bold|loud|impact|force|raw|punk|heavy|urban|protest|political|manifesto|aggressive|powerful|statement|confrontat/i],
  ["experimental-film", /film|cinema|movie|screen|dark|noir|drama|mystery|surreal|experimental|stranger|weird|uncanny|horror|psychological|absurd/i],
  ["swiss-grid",        /minimal|clean|grid|geometric|simple|pure|structural|systematic|design|modern|swiss|order|precise|rational|bauhaus|formal/i],
  ["magazine-cover",    /portrait|person|face|human|body|figure|people|profile|headshot|cover|fashion|model|celebrity|identity|selfhood/i],
];

/** Chooses the editorial preset based on the concept. Defaults to "editorial-hero". */
export function detectCollagePreset(concept: string): CollagePreset {
  const lower = (concept || "").toLowerCase();
  for (const [preset, pattern] of PRESET_SIGNALS) {
    if (pattern.test(lower)) return preset;
  }
  return "editorial-hero";
}

/** @deprecated Use detectCollagePreset — randomness undermines editorial consistency. */
export function randomCollagePattern(): CollagePreset {
  const presets: CollagePreset[] = ["editorial-hero","swiss-grid","brutalist-poster","magazine-cover","experimental-film"];
  return presets[Math.floor(Math.random() * presets.length)];
}

// ─── Palette ─────────────────────────────────────────────────────────────────

export type CollagePalette = { bg: string; accent1: string; accent2: string; text: string };

// Curated editorial palettes — Swiss design, Japanese poster, brutalist editorial
const EDITORIAL_PALETTES: CollagePalette[] = [
  { bg:"#f0ece4", accent1:"#c8290a", accent2:"#f5c200", text:"#0a0a0a" }, // Cream + Red + Gold
  { bg:"#0a0a0a", accent1:"#e8e0d0", accent2:"#c8290a", text:"#e8e0d0" }, // Black + Cream + Red
  { bg:"#f4f4f0", accent1:"#0a0a0a", accent2:"#c8290a", text:"#0a0a0a" }, // White + Black + Red
  { bg:"#1a1a1a", accent1:"#f5a623", accent2:"#f0ece4", text:"#f0ece4" }, // Dark + Orange + Cream
  { bg:"#f4f4f0", accent1:"#2356a8", accent2:"#c8290a", text:"#0a0a0a" }, // White + Blue + Red
  { bg:"#f0e8d8", accent1:"#8b1c10", accent2:"#1a1a1a", text:"#1a1a1a" }, // Warm Cream + Deep Red
  { bg:"#0d0d0d", accent1:"#c8290a", accent2:"#f0ece4", text:"#f0ece4" }, // Near-Black + Red + Cream
];

// Concept-keyword to palette index mapping
const CONCEPT_PALETTE_SIGNALS: [RegExp, CollagePalette][] = [
  [/dark|night|shadow|noir|death|void|absence|black|deep|underground/i,  EDITORIAL_PALETTES[1]], // Black + Cream + Red
  [/warm|orange|fire|energy|sun|heat|autumn|amber|gold|harvest|glow/i,  EDITORIAL_PALETTES[3]], // Dark + Orange + Cream
  [/blue|ocean|calm|trust|digital|water|sea|space|cold|ice|winter/i,    EDITORIAL_PALETTES[4]], // White + Blue + Red
  [/red|passion|danger|revolution|power|blood|bold|force|anger|war/i,   EDITORIAL_PALETTES[6]], // Near-Black + Red
  [/cream|vintage|retro|archive|aged|paper|classic|history|document/i,  EDITORIAL_PALETTES[0]], // Cream + Red + Gold
  [/white|light|pure|clean|minimal|air|silence|breath|open|space/i,     EDITORIAL_PALETTES[2]], // White + Black + Red
];

/**
 * Returns an editorial palette.
 * Priority: reference image colors → concept keyword → preset default.
 * @param extractedColors  hex strings from an uploaded reference image
 * @param concept          user's concept text — drives keyword palette selection
 */
export function buildCollagePalette(
  extractedColors: string[],
  concept = "",
): CollagePalette {
  if (extractedColors.length > 0) {
    // Wrap reference colors in an editorial shell: cream bg + ref accent
    const accent = extractedColors[0];
    const isDark = (() => {
      const r = parseInt(accent.slice(1,3),16);
      const g = parseInt(accent.slice(3,5),16);
      const b = parseInt(accent.slice(5,7),16);
      return (0.299*r + 0.587*g + 0.114*b) < 100;
    })();
    return isDark
      ? { bg:"#f0ece4", accent1: accent, accent2: extractedColors[1] ?? "#c8290a", text:"#0a0a0a" }
      : { bg:"#0a0a0a", accent1: accent, accent2: extractedColors[1] ?? "#f0ece4", text:"#f0ece4" };
  }
  for (const [pattern, palette] of CONCEPT_PALETTE_SIGNALS) {
    if (pattern.test(concept)) return palette;
  }
  // Default: Cream + Red + Gold — the most editorial-neutral palette
  return EDITORIAL_PALETTES[0];
}

// ─── Layer factory ────────────────────────────────────────────────────────────

function lyr(
  type: PosterLayer["type"],
  geo: { x:number; y:number; w:number; h:number; z:number; rot?:number },
  extra: Partial<PosterLayer> = {},
): PosterLayer {
  return {
    id: uuidv4(), type, label: type,
    x: geo.x, y: geo.y, width: geo.w, height: geo.h,
    zIndex: geo.z, rotation: geo.rot ?? 0,
    opacity: 1, visible: true, locked: false,
    ...extra,
  };
}

function mkText(
  text: string, font: string, size: number,
  fill: string, align: "left"|"center"|"right" = "left",
  opts: Partial<{ letterSpacing: number; lineHeight: number; writingMode: "horizontal"|"vertical" }> = {},
) {
  return { textData: { text, fontFamily:font, fontSize:size, fontWeight:700, fontStyle:"normal",
    fill, align, letterSpacing: opts.letterSpacing ?? 0, lineHeight: opts.lineHeight ?? 0.9,
    textTransform:"uppercase" as const, writingMode: opts.writingMode ?? "horizontal" as const } };
}

function mkShape(fill: string, type: "rect"|"circle" = "rect") {
  return { shapeData: { shapeType:type, fill, stroke:"none", strokeWidth:0 } };
}

// Global texture helper — always added at zIndex 20 to unify the composition
function globalTexture(W:number, H:number, opacity = 0.06): PosterLayer {
  return lyr("noiseTexture", { x:0, y:0, w:W, h:H, z:20 }, { opacity });
}

// Micro information helper — small editorial labels that signal design quality
function microInfo(text: string, x:number, y:number, w:number, fill:string, rot = 0, z = 8): PosterLayer {
  return lyr("metaText", { x, y, w, h:18, z, rot }, {
    textData: { text, fontFamily:"Space Mono", fontSize:10, fontWeight:400, fontStyle:"normal",
      fill, align:"left", letterSpacing:4, lineHeight:1.4, textTransform:"uppercase" as const,
      writingMode: rot !== 0 ? "horizontal" as const : "horizontal" as const },
  });
}

// ─── Preset geometry builders ─────────────────────────────────────────────────
//
// Design principles for ALL presets:
//  • Subjects occupy 70-85% of canvas height (dominant, not small)
//  • Typography is 150-220px (major visual element, not caption)
//  • Global texture layer always present at zIndex 20
//  • Micro information always present (small labels, archive-style)
//  • Accent shapes ANCHOR the composition — they support subjects and type

// ── 1. Editorial Hero ─────────────────────────────────────────────────────────
// One dominant subject. Massive title BEHIND subject (subject cuts through text).
// Inspired by Japanese poster design, Swiss editorial, contemporary art books.

function buildEditorialHero(W:number, H:number, n:number, p:CollagePalette, concept:string): PosterLayer[] {
  const M = 44;
  const title = concept.toUpperCase() || "POSTER";
  const isDark = p.bg === "#0a0a0a" || p.bg === "#1a1a1a";

  return [
    // Foundation
    lyr("solidBackground", {x:0,y:0,w:W,h:H,z:0}, mkShape(p.bg)),

    // Thin accent line — compositional anchor, divides reading zones
    lyr("accentLine", {x:0, y:Math.round(H*0.88), w:W, h:3, z:2}, mkShape(p.accent1)),

    // MASSIVE title — z:3, subject at z:4 cuts through it (intentional drama)
    lyr("titleText", {
      x: -2, y: Math.round(H*0.56),
      w: W+4, h: Math.round(H*0.28), z:3,
    }, mkText(title, "Bebas Neue", 200, isDark ? p.accent1 : p.text, "left",
      { letterSpacing:-3, lineHeight:0.84 })),

    // HERO SUBJECT — large, dominant (80% H), positioned center-left
    lyr("subjectImage", {
      x: Math.round(W*0.10), y: Math.round(H*0.02),
      w: Math.round(W*0.68), h: Math.round(H*0.82), z:4,
    }, { imageData:{src:"__SUBJECT_0__", fit:"contain"} }),

    // Secondary subject (only if 2 images) — smaller, far right, supporting role
    ...(n >= 2 ? [lyr("subjectImage", {
      x: Math.round(W*0.62), y: Math.round(H*0.40),
      w: Math.round(W*0.32), h: Math.round(H*0.40), z:5,
    }, { imageData:{src:"__SUBJECT_1__", fit:"contain"} })] : []),

    // Tagline — below accent line
    lyr("subtitleText", {
      x: M, y: Math.round(H*0.90), w: Math.round(W*0.70), h: 28, z:6,
    }, { textData:{ text: concept || "editorial", fontFamily:"Space Mono", fontSize:13,
        fontWeight:400, fontStyle:"normal", fill:isDark ? p.accent1 : p.text,
        align:"left", letterSpacing:5, lineHeight:1.3, textTransform:"none" as const } }),

    // Micro info — archive label, right edge
    microInfo("ARC·2025·001", Math.round(W*0.82), Math.round(H*0.91), Math.round(W*0.16),
      isDark ? "#666666" : "#888888", 0, 7),
    // Micro info — vertical left edge (signature editorial detail)
    microInfo(concept.toUpperCase().slice(0,18) || "DESIGN EDITION", 14,
      Math.round(H*0.50), Math.round(H*0.30),
      isDark ? "#444444" : "#aaaaaa", -90, 7),

    // Global texture — unifies everything, makes it feel like a physical artifact
    globalTexture(W, H, isDark ? 0.05 : 0.07),
  ];
}

// ── 2. Swiss Grid ─────────────────────────────────────────────────────────────
// Strict grid structure. Subject upper-left. Bold headline in lower half.
// Baseline grid implied by ruler line. Clean, systematic, authoritative.

function buildSwissGrid(W:number, H:number, n:number, p:CollagePalette, concept:string): PosterLayer[] {
  const M = 44;
  const title = concept.toUpperCase() || "DESIGN";
  const divY = Math.round(H * 0.52);

  return [
    lyr("solidBackground", {x:0,y:0,w:W,h:H,z:0}, mkShape(p.bg)),

    // Strong horizontal rule — THE grid anchor
    lyr("geometricShape", {x:0, y:divY, w:W, h:8, z:2}, mkShape(p.text)),

    // Small accent block — top-right, creates secondary focal point
    lyr("geometricShape", {
      x: Math.round(W*0.76), y: 0,
      w: Math.round(W*0.24), h: Math.round(H*0.22), z:1,
    }, mkShape(p.accent1)),

    // HERO SUBJECT — upper zone, dominant, bleeds to left edge
    lyr("subjectImage", {
      x: 0, y: 0,
      w: Math.round(W*0.70), h: Math.round(H*0.50), z:3,
    }, { imageData:{src:"__SUBJECT_0__", fit:"contain"} }),

    // Secondary subject — upper-right supporting
    ...(n >= 2 ? [lyr("subjectImage", {
      x: Math.round(W*0.70), y: Math.round(H*0.22),
      w: Math.round(W*0.28), h: Math.round(H*0.30), z:4,
    }, { imageData:{src:"__SUBJECT_1__", fit:"contain"} })] : []),

    // HEADLINE — below the rule, bold condensed, full width
    lyr("titleText", {
      x: M, y: Math.round(H*0.54),
      w: W - M, h: Math.round(H*0.26), z:5,
    }, mkText(title, "Space Grotesk", 100, p.text, "left",
      { letterSpacing:-4, lineHeight:0.88 })),

    // Secondary text — right column, upper zone
    lyr("subtitleText", {
      x: Math.round(W*0.76), y: M,
      w: Math.round(W*0.20), h: Math.round(H*0.20), z:4,
    }, { textData:{ text: concept || "2025 Collection", fontFamily:"Space Mono", fontSize:12,
        fontWeight:400, fontStyle:"normal", fill:p.text,
        align:"left", letterSpacing:2, lineHeight:1.5, textTransform:"none" as const } }),

    // Micro info strip — bottom
    microInfo(`${concept.slice(0,12).toUpperCase() || "POSTER"} · 2025`,
      M, Math.round(H*0.92), Math.round(W*0.55), p.text, 0, 7),
    // Vertical meta — far right
    microInfo("SERIES 01", Math.round(W*0.93), Math.round(H*0.60), 60, "#888888", -90, 7),

    // Thin horizontal detail line
    lyr("accentLine", {x:M, y:Math.round(H*0.80), w:Math.round(W*0.40), h:2, z:6},
      mkShape(p.accent1)),

    globalTexture(W, H, 0.05),
  ];
}

// ── 3. Brutalist Poster ───────────────────────────────────────────────────────
// Maximum aggression. Oversized type as primary element.
// Subject is secondary to the typographic force.
// Confrontational, raw, high-contrast.

function buildBrutalistPoster(W:number, H:number, n:number, p:CollagePalette, concept:string): PosterLayer[] {
  const M = 44;
  const title = concept.toUpperCase() || "BRUTAL";
  const stripH = Math.round(H * 0.32);

  // Force white bg for brutalist — maximum contrast
  const bgColor = "#f0ece4";
  const blackStrip = "#0a0a0a";
  const accent = p.accent1;

  return [
    lyr("solidBackground", {x:0,y:0,w:W,h:H,z:0}, mkShape(bgColor)),

    // FULL-WIDTH BLACK STRIP — top third, the brutal signature
    lyr("geometricShape", {x:0,y:0,w:W,h:stripH,z:1}, mkShape(blackStrip)),

    // Accent block — lower zone, creates tension
    lyr("geometricShape", {
      x: 0, y: Math.round(H*0.27),
      w: Math.round(W*0.58), h: Math.round(H*0.52), z:2,
    }, mkShape(accent)),

    // ENORMOUS TITLE in black strip — z:3, below subject
    // The size IS the design
    lyr("titleText", {
      x: M, y: Math.round(H*0.01),
      w: W - M, h: Math.round(H*0.30), z:3,
    }, mkText(title, "Bebas Neue", 210, "#f0ece4", "left",
      { letterSpacing:-6, lineHeight:0.82 })),

    // HERO SUBJECT — spans strip and accent block, cuts through both
    lyr("subjectImage", {
      x: Math.round(W*0.22), y: Math.round(H*0.06),
      w: Math.round(W*0.62), h: Math.round(H*0.82), z:4,
    }, { imageData:{src:"__SUBJECT_0__", fit:"contain"} }),

    // Secondary (if 2 images) — far left, smaller, supporting
    ...(n >= 2 ? [lyr("subjectImage", {
      x: 0, y: Math.round(H*0.34),
      w: Math.round(W*0.28), h: Math.round(H*0.36), z:5,
    }, { imageData:{src:"__SUBJECT_1__", fit:"contain"} })] : []),

    // Secondary text — lower right, clean contrast
    lyr("bodyText", {
      x: Math.round(W*0.60), y: Math.round(H*0.72),
      w: Math.round(W*0.36), h: Math.round(H*0.16), z:6,
    }, { textData:{ text: concept || "no compromise", fontFamily:"Space Mono", fontSize:13,
        fontWeight:400, fontStyle:"normal", fill:"#0a0a0a",
        align:"left", letterSpacing:2, lineHeight:1.5, textTransform:"none" as const } }),

    // Micro info
    microInfo("ED·01/50·2025", M, Math.round(H*0.92), Math.round(W*0.50), "#333333", 0, 7),
    microInfo("B·R·T·L", Math.round(W*0.84), Math.round(H*0.40), 40, "#f0ece4", -90, 7),

    globalTexture(W, H, 0.09), // heavier newsprint feel
  ];
}

// ── 4. Magazine Cover ─────────────────────────────────────────────────────────
// Hero subject fills the upper frame. Bold title straddles the image/text
// boundary. Right column carries editorial information hierarchy.

function buildMagazineCover(W:number, H:number, n:number, p:CollagePalette, concept:string): PosterLayer[] {
  const M = 44;
  const title = concept.toUpperCase() || "COVER";
  const isDark = p.bg === "#0a0a0a" || p.bg === "#0d0d0d" || p.bg === "#1a1a1a";

  return [
    lyr("solidBackground", {x:0,y:0,w:W,h:H,z:0}, mkShape(p.bg)),

    // Accent bar — top branding strip
    lyr("geometricShape", {x:0,y:0,w:W,h:Math.round(H*0.055),z:1}, mkShape(p.accent1)),

    // Brand label inside the accent bar
    lyr("metaText", {
      x: M, y: Math.round(H*0.008), w: Math.round(W*0.65), h: Math.round(H*0.04), z:6,
    }, { textData:{ text: "POSTER AGENT · ISSUE 01 · 2025", fontFamily:"Space Mono", fontSize:11,
        fontWeight:400, fontStyle:"normal",
        fill: isDark ? "#0a0a0a" : "#f0ece4",
        align:"left", letterSpacing:4, lineHeight:1.4, textTransform:"uppercase" as const } }),

    // HERO SUBJECT — large, slightly left-anchored (bleeds to top strip)
    lyr("subjectImage", {
      x: Math.round(W*0.04), y: Math.round(H*0.06),
      w: Math.round(W*0.64), h: Math.round(H*0.70), z:3,
    }, { imageData:{src:"__SUBJECT_0__", fit:"contain"} }),

    // Secondary subject — right, supporting role
    ...(n >= 2 ? [lyr("subjectImage", {
      x: Math.round(W*0.60), y: Math.round(H*0.08),
      w: Math.round(W*0.36), h: Math.round(H*0.44), z:4,
    }, { imageData:{src:"__SUBJECT_1__", fit:"contain"} })] : []),

    // Accent line — separates image zone from type zone
    lyr("accentLine", {x:0, y:Math.round(H*0.74), w:W, h:4, z:4}, mkShape(p.accent1)),

    // MAIN TITLE — 170px, dominant editorial weight
    lyr("titleText", {
      x: M, y: Math.round(H*0.75),
      w: W - M, h: Math.round(H*0.17), z:5,
    }, mkText(title, "Bebas Neue", 170, p.text, "left",
      { letterSpacing:-2, lineHeight:0.86 })),

    // Editorial column — right side, stacked info
    lyr("subtitleText", {
      x: Math.round(W*0.66), y: Math.round(H*0.56),
      w: Math.round(W*0.30), h: Math.round(H*0.18), z:5,
    }, { textData:{ text: concept || "editorial", fontFamily:"Space Mono", fontSize:11,
        fontWeight:400, fontStyle:"normal", fill: isDark ? p.accent1 : p.text,
        align:"left", letterSpacing:2, lineHeight:1.6, textTransform:"none" as const } }),

    // Micro info — bottom strip
    microInfo(`${concept.slice(0,12).toUpperCase() || "EDITORIAL"} · ${new Date().getFullYear()}`,
      M, Math.round(H*0.94), Math.round(W*0.60), isDark ? "#666666" : "#999999", 0, 7),
    microInfo("ED·001/050", Math.round(W*0.76), Math.round(H*0.94), Math.round(W*0.20),
      isDark ? "#555555" : "#aaaaaa", 0, 7),

    globalTexture(W, H, isDark ? 0.06 : 0.05),
  ];
}

// ── 5. Experimental Film ──────────────────────────────────────────────────────
// Dramatic asymmetric composition. Subject breaks from expected frame.
// Title passes behind subject. Cinematic energy. Inspired by movie poster design.

function buildExperimentalFilm(W:number, H:number, n:number, p:CollagePalette, concept:string): PosterLayer[] {
  const M = 44;
  const title = concept.toUpperCase() || "FILM";
  const isDark = p.bg === "#0a0a0a" || p.bg === "#1a1a1a";

  return [
    lyr("solidBackground", {x:0,y:0,w:W,h:H,z:0}, mkShape(isDark ? "#0a0a0a" : p.bg)),

    // LARGE CIRCLE — compositional anchor behind subject
    lyr("geometricShape", {
      x: Math.round(W*0.18), y: Math.round(H*0.06),
      w: Math.round(W*0.72), h: Math.round(W*0.72), z:1, // square = circle via shapeType
    }, { shapeData:{ shapeType:"circle", fill:p.accent1, stroke:"none", strokeWidth:0 } }),

    // Thin diagonal accent line — creates energy
    lyr("accentLine", {
      x: 0, y: Math.round(H*0.82),
      w: Math.round(W*0.65), h: 4, z:2,
    }, mkShape(isDark ? p.accent1 : p.text)),

    // TITLE — enormous, z:3, below subject (subject cuts through it)
    lyr("titleText", {
      x: M - 10, y: Math.round(H*0.62),
      w: W - M + 10, h: Math.round(H*0.25), z:3,
    }, mkText(title, "Bebas Neue", 190, isDark ? "#f0ece4" : p.text, "left",
      { letterSpacing:6, lineHeight:0.82 })),

    // HERO SUBJECT — large, slightly offset, ABOVE title (cuts through)
    lyr("subjectImage", {
      x: Math.round(W*0.06), y: Math.round(H*0.02),
      w: Math.round(W*0.72), h: Math.round(H*0.84), z:4,
    }, { imageData:{src:"__SUBJECT_0__", fit:"contain"} }),

    // Secondary subject — lower right, partially behind hero
    ...(n >= 2 ? [lyr("subjectImage", {
      x: Math.round(W*0.55), y: Math.round(H*0.52),
      w: Math.round(W*0.40), h: Math.round(H*0.40), z:2,
    }, { imageData:{src:"__SUBJECT_1__", fit:"contain"} })] : []),

    // Tagline / film info
    lyr("subtitleText", {
      x: M, y: Math.round(H*0.88),
      w: Math.round(W*0.75), h: 24, z:5,
    }, { textData:{ text: concept || "A film by", fontFamily:"Space Mono", fontSize:12,
        fontWeight:400, fontStyle:"normal", fill:isDark ? "#888888" : "#555555",
        align:"left", letterSpacing:3, lineHeight:1.4, textTransform:"none" as const } }),

    // Micro info — vertical right edge (cinematic feel)
    microInfo(concept.slice(0,14).toUpperCase() || "DIRECTED BY",
      Math.round(W*0.92), Math.round(H*0.15), Math.round(H*0.45),
      isDark ? "#444444" : "#aaaaaa", -90, 7),
    microInfo("2025 · EXPERIMENTAL",
      M, Math.round(H*0.94), Math.round(W*0.55),
      isDark ? "#444444" : "#999999", 0, 7),

    globalTexture(W, H, 0.08), // film grain feel
  ];
}

// ─── Main template builder ────────────────────────────────────────────────────

export function buildCollageLayoutTemplate(
  preset: CollagePreset,
  canvas: CanvasConfig,
  imageCount: number,
  palette: CollagePalette,
  concept: string,
): PosterLayer[] {
  const { width: W, height: H } = canvas;
  const n = Math.min(imageCount, 2); // max 2 subjects: enforce editorial hierarchy
  const builders: Record<CollagePreset, (W:number,H:number,n:number,p:CollagePalette,c:string)=>PosterLayer[]> = {
    "editorial-hero":    buildEditorialHero,
    "swiss-grid":        buildSwissGrid,
    "brutalist-poster":  buildBrutalistPoster,
    "magazine-cover":    buildMagazineCover,
    "experimental-film": buildExperimentalFilm,
  };
  return (builders[preset] ?? buildEditorialHero)(W, H, n, palette, concept);
}

// ─── Editorial typography guidance ───────────────────────────────────────────

const EDITORIAL_FONT_SYSTEMS: Record<string, { display: string; body: string }> = {
  "swiss-modern":      { display:"Space Grotesk",  body:"Inter" },
  "neo-grotesk":       { display:"Inter",           body:"Space Mono" },
  "editorial-serif":   { display:"Playfair Display", body:"Space Mono" },
  "brutalist":         { display:"Bebas Neue",       body:"Space Mono" },
  "condensed-poster":  { display:"Oswald",           body:"Inter" },
  "japanese-minimal":  { display:"Bebas Neue",       body:"Space Mono" },
};

// ─── GPT-4o style prompts ─────────────────────────────────────────────────────

export function buildCollageStyleSystemPrompt(): string {
  return `You are a senior editorial poster designer with the authority and taste of Wolfgang Weingart, Neville Brody, Saul Bass, and the A24 design team.
You design for cultural institutions, film festivals, galleries, and avant-garde publications.

YOUR TASK: personalize the text content and color fields in the provided template layers to create a professionally designed editorial poster.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT THIS IS AND IS NOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Editorial visual composition — high-contrast, physically present, designed with conviction
✗ NOT Canva. NOT clip-art decoration. NOT a scrapbook. NOT generic AI output.

The viewer must look at this poster and feel: "A human designer made this."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY QUALITY STANDARDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TITLE (most critical field):
  • Max 3 words. ALL-CAPS. SHORT. EMOTIONALLY RESONANT.
  • Must evoke the CONCEPT — not describe the poster format
  • ✓ Examples: "VOID", "HUMAN ERROR", "THE WEIGHT", "COLLAPSE", "SIGNAL LOSS", "NO EXIT", "SYSTEM FAILURE", "REMAINS"
  • ✗ Reject immediately: "Art Poster 2025", "Exhibition Title", "Our Poster"
  • Think: what 1-3 words capture the ESSENCE or TENSION of the concept?

TAGLINE:
  • 1 editorial line, 30–50 characters max
  • Lowercase or title case. Evocative, specific.
  • Examples: "Architecture in conflict" / "The last signal" / "Form follows feeling" / "When systems collapse"

MICRO INFORMATION (archive / catalog labels):
  • Must feel like real production data, not placeholder text
  • ✓ "ACT·2025·081·COLLECTION I", "LAT 41°N · 012°E · ISSUE 3", "ED·3/50·ARCHIVE·A"
  • ✗ Reject: "ARC·2025·001" (too generic), "META INFO", "Label Text"

SHAPES (geometricShape layers):
  • Fill must use ONLY the palette colors provided — never invent new hex values
  • Do NOT change shape positions, dimensions, or zIndex

COLORS:
  • ONLY use palette colors from the prompt — no new hex values
  • Text fills must have strong contrast against their background zone
  • Prefer pure black (#0a0a0a) or pure white/cream (#f0ece4) for text on most backgrounds

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICTLY PROHIBITED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Changing x, y, width, height, zIndex, rotation, type, id
- Changing imageData.src (keep __SUBJECT_N__ exactly as-is)
- Adding or removing layers
- Emoji in any layer label
- Generic filler text ("Poster Title", "Your Subtitle", "Name Here")
- Inventing hex colors not in the provided palette

Return ONLY valid JSON. No markdown fences. No explanatory text before or after.`;
}

export function buildCollageStyleUserPrompt(
  templateLayers: PosterLayer[],
  setup: PosterSetupConfig,
  canvas: CanvasConfig,
  presetId: CollagePreset,
  palette: CollagePalette,
): string {
  const preset = COLLAGE_PATTERNS[presetId];
  const concept = setup.prompt || "editorial poster";

  const fontSystem = (
    presetId === "brutalist-poster"  ? EDITORIAL_FONT_SYSTEMS["brutalist"] :
    presetId === "swiss-grid"        ? EDITORIAL_FONT_SYSTEMS["swiss-modern"] :
    presetId === "magazine-cover"    ? EDITORIAL_FONT_SYSTEMS["neo-grotesk"] :
    presetId === "experimental-film" ? EDITORIAL_FONT_SYSTEMS["condensed-poster"] :
    EDITORIAL_FONT_SYSTEMS["editorial-serif"]
  ) ?? { display:"Bebas Neue", body:"Space Mono" };

  const isDark = palette.bg === "#0a0a0a" || palette.bg === "#0d0d0d" || palette.bg === "#1a1a1a";
  const subjectCount = Math.min(templateLayers.filter(l => l.type === "subjectImage").length, 2);

  const typographySystem =
    presetId === "brutalist-poster"  ? "brutalist" :
    presetId === "swiss-grid"        ? "swiss-modern" :
    presetId === "magazine-cover"    ? "neo-grotesk" :
    presetId === "experimental-film" ? "condensed-poster" :
    "editorial-serif";

  const globalTexture =
    presetId === "brutalist-poster"  ? "newsprint" :
    presetId === "experimental-film" ? "film-grain" :
    "paper-grain";

  // Generate concept-specific title word options
  const conceptWords = concept.split(/\s+/).filter(w => w.length > 2);
  const titleWord1 = conceptWords[0]?.toUpperCase() ?? "VOID";
  const titleWord2 = conceptWords.slice(0,2).join(" ").toUpperCase();
  const titlePhrase = `THE ${titleWord1}`;

  return `═══════════════════════════════════════════════
EDITORIAL POSTER BRIEF
═══════════════════════════════════════════════

CONCEPT:  "${concept}"
PRESET:   ${preset.name} — ${preset.tagline}
CANVAS:   ${canvas.width} × ${canvas.height}px
LANGUAGE: ${setup.language ?? "en"}

───────────────────────────────────────────────
PALETTE — use ONLY these four colors
───────────────────────────────────────────────
  Background:  ${palette.bg}
  Accent 1:    ${palette.accent1}   ← primary accent (shapes, emphasis lines)
  Accent 2:    ${palette.accent2}   ← secondary accent (supporting shapes)
  Text:        ${palette.text}

───────────────────────────────────────────────
TYPOGRAPHY SYSTEM: ${typographySystem.toUpperCase()}
───────────────────────────────────────────────
  Display font:  ${fontSystem.display}
  Body font:     ${fontSystem.body}

TITLE — this is the most important field:
  • Write 1–3 ALL-CAPS words that CAPTURE the concept's emotional core
  • Suggested from "${concept}":
      Option A: "${titleWord1}"
      Option B: "${titleWord2}"
      Option C: "${titlePhrase}"
  • Choose whichever feels most powerful, or write a better alternative
  • The title must feel like it belongs in a museum or cinema lobby

TAGLINE — 1 editorial line, 30–50 chars:
  • Evocative, specific to "${concept}"
  • Lowercase or title case (never all-caps)
  • Example register: "Architecture in conflict" / "When the signal fails"

MICRO INFORMATION — real archive/production data:
  • Each micro info label must feel authentic, not placeholder
  • Include: archive codes, coordinates, edition numbers, years
  • Example format: "ACT·2025·${String(Math.floor(Math.random()*99)+1).padStart(3,'0')}·SERIES·I"
  • Coordinates: "LAT ${Math.floor(Math.random()*60+10)}°N · ${String(Math.floor(Math.random()*360)).padStart(3,'0')}°E"

───────────────────────────────────────────────
DIRECTOR PLAN (required in your JSON response)
───────────────────────────────────────────────
{
  "composition_template": "${presetId}",
  "hero_subject_count": ${subjectCount},
  "typography_system": "${typographySystem}",
  "typography_primary_font": "${fontSystem.display}",
  "typography_secondary_font": "${fontSystem.body}",
  "global_texture": "${globalTexture}",
  "color_scheme": "${isDark ? "dark-gray-accent" : "black-white-red"}",
  "accent_color": "${palette.accent1}",
  "micro_information": ["archive-code", "coordinates", "edition-number"]
}

───────────────────────────────────────────────
TEMPLATE LAYERS
Personalize: text content + color fills only.
NEVER change: x, y, width, height, zIndex, rotation, type, id, imageData.src
───────────────────────────────────────────────
${JSON.stringify(templateLayers, null, 2)}

───────────────────────────────────────────────
EDITORIAL RULES (enforce all)
───────────────────────────────────────────────
1. TITLE: max 3 words, ALL-CAPS, emotionally resonant — NOT descriptive or generic
2. TAGLINE: 1 editorial line, 30–50 chars, lowercase/title case
3. BODY TEXT: rewrite to match concept mood — not template filler
4. MICRO INFO: real-feeling archive/catalog data with codes, coords, editions
5. SHAPE COLORS: shapeData.fill → ONLY use palette colors listed above
6. BACKGROUND: solidBackground shapeData.fill must stay as ${palette.bg}
7. TEXT CONTRAST: fills must be legible — dark text on light zones, light on dark
8. NO NEW COLORS: never invent hex values outside the palette

RETURN exactly this JSON structure:
{
  "plan": { ...the director plan above, with your concept-appropriate title/tagline... },
  "layers": [ ...ALL layers in original order, text + color fields personalized... ],
  "fonts": { "display": "${fontSystem.display}", "body": "${fontSystem.body}" },
  "palette": { "dominant": "${palette.text}", "secondary": "${palette.bg}", "accent": "${palette.accent1}", "background": "${palette.bg}" }
}`;
}

// ─── Style merge ──────────────────────────────────────────────────────────────

export function mergeStyleIntoTemplate(
  template: PosterLayer[],
  gptLayers: Partial<PosterLayer>[],
): PosterLayer[] {
  return template.map((t) => {
    const g = gptLayers.find((l) => l.id === t.id);
    if (!g) return t;
    const merged: PosterLayer = {
      ...t, ...g,
      // Always restore geometry from template
      id: t.id, type: t.type, label: t.label,
      x: t.x, y: t.y, width: t.width, height: t.height,
      zIndex: t.zIndex, rotation: t.rotation,
      visible: t.visible, locked: t.locked,
    };
    if (t.type === "subjectImage") merged.imageData = t.imageData;
    if (t.type === "solidBackground") merged.shapeData = t.shapeData;
    if (t.type === "noiseTexture") { merged.opacity = t.opacity; }
    return merged;
  });
}

// ─── Debug grid ───────────────────────────────────────────────────────────────

const GRID_SYMBOL: Partial<Record<PosterLayer["type"], string>> = {
  titleText:"TT", subtitleText:"ST", bodyText:"BT", metaText:"MT",
  subjectImage:"SI", backgroundImage:"BI", geometricShape:"GS",
  accentLine:"AL", solidBackground:"BG", noiseTexture:"NX", colorOverlay:"CO",
};

export function logCollageDebugGrid(layers: PosterLayer[], canvas: CanvasConfig, preset: CollagePreset): void {
  const W = canvas.width;
  const colW = W / 12;
  const bar = "─".repeat(62);

  console.log(`\n[collage-grid] ╔${bar}╗`);
  console.log(`[collage-grid] ║  PRESET: ${preset.padEnd(25)} Canvas ${W}×${canvas.height}  ║`);
  console.log(`[collage-grid] ╠${bar}╣`);
  console.log(`[collage-grid] ║  Layer               z   Col: 1  2  3  4  5  6  7  8  9 10 11 12  ║`);
  console.log(`[collage-grid] ╠${bar}╣`);

  for (const l of [...layers].filter(l => l.visible).sort((a,b) => (a.zIndex??0)-(b.zIndex??0))) {
    const sym = GRID_SYMBOL[l.type] ?? "??";
    const s = Math.max(0, Math.floor(l.x / colW));
    const e = Math.min(11, Math.ceil((l.x + l.width) / colW) - 1);
    const grid = Array.from({length:12}, (_,i) => i >= s && i <= e ? sym : " ·");
    console.log(`[collage-grid] ║  ${l.label.padEnd(20).slice(0,20)} ${String(l.zIndex??0).padStart(3)}    ${grid.join("  ")}  ║`);
  }
  console.log(`[collage-grid] ╚${bar}╝\n`);
}

// ─── Completeness check ───────────────────────────────────────────────────────

export interface CompletenessCheck {
  backgroundPresent: boolean;
  patternChosen: boolean;
  subjectsSpread: boolean;
  typographyConnected: boolean;
  hierarchyClear: boolean;
  passes: boolean;
}

export function checkCollageCompleteness(
  layers: PosterLayer[],
  canvas: CanvasConfig,
  preset: CollagePreset | undefined,
): CompletenessCheck {
  const W = canvas.width;
  const H = canvas.height;
  const bg = layers.find(l => l.type === "solidBackground" && l.visible);
  const backgroundPresent = !!bg && bg.x === 0 && bg.y === 0 && bg.width >= W*0.98 && bg.height >= H*0.98;
  const patternChosen = !!preset;
  const subjects = layers.filter(l => l.type === "subjectImage" && l.visible);
  const subjectsSpread = subjects.length <= 1 || (() => {
    for (let i = 0; i < subjects.length; i++)
      for (let j = i+1; j < subjects.length; j++)
        if (Math.abs(subjects[i].x - subjects[j].x) < 100 && Math.abs(subjects[i].y - subjects[j].y) < 100) return false;
    return !subjects.some(s => s.x < 20 && s.y < 20);
  })();
  const title = layers.find(l => l.type === "titleText" && l.visible);
  const anchors = layers.filter(l => l.visible && (l.type === "subjectImage" || l.type === "geometricShape"));
  const typographyConnected = !title || anchors.length === 0 || anchors.some(a => {
    const dx = Math.abs((title.x + title.width/2) - (a.x + a.width/2));
    const dy = Math.abs((title.y + title.height/2) - (a.y + a.height/2));
    return dx < W*0.5 && dy < H*0.5;
  });
  const titleSize = title?.textData?.fontSize ?? 0;
  const otherText = layers.filter(l => l.type !== "titleText" && l.visible && (l.textData?.fontSize ?? 0) > 0);
  const hierarchyClear = titleSize === 0 || otherText.length === 0 ||
    otherText.every(l => (l.textData?.fontSize ?? 0) <= titleSize * 0.6);
  const passes = backgroundPresent && patternChosen && subjectsSpread && typographyConnected && hierarchyClear;
  return { backgroundPresent, patternChosen, subjectsSpread, typographyConnected, hierarchyClear, passes };
}

// ─── Palette extraction ───────────────────────────────────────────────────────
// (kept for legacy callers; buildCollagePalette already defined above)
