/**
 * Typography Director — first-class typographic art direction.
 *
 * This module decides the typography strategy BEFORE layout generation.
 * Typography is not a styling afterthought — it is a first-class design component.
 *
 * Responsibilities:
 *   1. Select the right typography preset for the module + category/mood
 *   2. Suggest a campaign-style headline (not the literal product/event name)
 *   3. Provide font pair, scale, tracking, and type treatment
 *   4. Define how type interacts with the composition
 *   5. Build a prompt block that gets injected into each module's layout prompt
 *
 * One GPT call — typography direction is embedded into the layout prompt,
 * not a separate API round-trip.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type TypographyPreset =
  | "swiss-modern"       // Helvetica-era, grid, high contrast, oversized scale
  | "luxury-editorial"   // Elegant serif, quiet luxury, large negative space
  | "tech-minimal"       // Apple precision, minimal text, perfect spacing
  | "festival"           // Bold condensed, atmospheric, monumental scale
  | "brutalist"          // Oversized letterforms, aggressive, breaking rules
  | "cinematic";         // Movie poster emotion, title card quality

export type TypeInteraction =
  | "text-behind-image"      // title z < product z → image visually cuts through text
  | "text-in-negative-space" // title in the compositional void — top or bottom zone
  | "oversized-cropped"      // title bleeds off canvas edges intentionally
  | "anchored-to-shape"      // title aligned to or touching a geometric shape
  | "text-over-image"        // title renders on top of a darkened image zone
  | "standard";              // conventional placement

export type TypeScale =
  | "compact"    // 14–28px  — label / meta
  | "medium"     // 32–54px  — supporting headline
  | "large"      // 60–90px  — confident headline
  | "oversized"  // 100–140px — dominant headline
  | "monumental";// 150–240px — letterforms AS design element

// ─── Preset definitions ───────────────────────────────────────────────────────

interface PresetDef {
  id: TypographyPreset;
  name: string;
  references: string;           // real-world references
  font_display: string[];       // ranked — first is default
  font_body: string[];
  headline_weight: 400 | 700 | 900;
  headline_case: "uppercase" | "title-case";
  headline_line_height: number; // 0.78–1.05
  tracking_default: number;     // letterSpacing px for the headline
  tracking_wide: number;        // for body/meta layers
  default_scale: TypeScale;
  interaction: TypeInteraction;
  visual_weight_role: "typography-hero" | "image-hero" | "balanced";
  guidance: string;             // injected into the GPT prompt verbatim
}

const PRESETS: Record<TypographyPreset, PresetDef> = {

  "swiss-modern": {
    id: "swiss-modern",
    name: "Swiss Modern",
    references: "Helvetica, Neue Haas Grotesk, Suisse International, Vignelli",
    font_display: ["Space Grotesk", "Inter", "Bebas Neue"],
    font_body:    ["Space Mono", "Inter"],
    headline_weight:     700,
    headline_case:       "uppercase",
    headline_line_height: 0.87,
    tracking_default:    -3,
    tracking_wide:        4,
    default_scale:       "oversized",
    interaction:         "text-in-negative-space",
    visual_weight_role:  "balanced",
    guidance: `SWISS MODERN:
  • Title: uppercase, LARGE to OVERSIZED (80-120px), tracking: -2 to -4px, lineHeight: 0.85-0.90
  • Body: smaller, systematic, Space Mono or Inter — secondary role
  • Grid discipline: strict left or strict center alignment throughout — never mix
  • Let the type BREATHE — negative space is part of the composition
  • Color: single-color type, maximum contrast (black on white, white on black)
  • DO NOT add decorative elements to the type — Swiss Modern is pure structure`,
  },

  "luxury-editorial": {
    id: "luxury-editorial",
    name: "Luxury Editorial",
    references: "Vogue, Saint Laurent, Aesop, Celine, Maison Margiela",
    font_display: ["Playfair Display", "Cormorant Garamond", "EB Garamond"],
    font_body:    ["Inter", "Space Mono"],
    headline_weight:     400,
    headline_case:       "title-case",
    headline_line_height: 1.08,
    tracking_default:     4,
    tracking_wide:       12,
    default_scale:       "large",
    interaction:         "text-in-negative-space",
    visual_weight_role:  "image-hero",
    guidance: `LUXURY EDITORIAL:
  • Title: elegant serif — Playfair Display or Cormorant Garamond — RESTRAINED scale (44-72px)
  • Weight: regular (400) or light — NOT bold. Luxury whispers.
  • Tracking: 4-12px for the headline, 10-20px for brand/meta labels
  • Large negative space is INTENTIONAL — do not fill empty areas
  • Body: minimal, Inter light — type is a supporting voice, not a shouting presence
  • Alignment: left-aligned or centered — choose ONE and stay with it
  • Color: cream on dark, dark on cream — never neon
  • The type should feel PLACED by a confident, calm designer — not generated`,
  },

  "tech-minimal": {
    id: "tech-minimal",
    name: "Tech Minimal",
    references: "Apple, Nothing Phone, Dyson, Linear, Vercel",
    font_display: ["Inter", "DM Sans", "Space Grotesk"],
    font_body:    ["Space Mono", "IBM Plex Mono"],
    headline_weight:     700,
    headline_case:       "title-case",
    headline_line_height: 0.93,
    tracking_default:    -2,
    tracking_wide:        2,
    default_scale:       "large",
    interaction:         "text-in-negative-space",
    visual_weight_role:  "image-hero",
    guidance: `TECH MINIMAL:
  • Title: clean geometric sans — Inter or DM Sans — MEDIUM scale (44-80px)
  • Fewer words = more precision. Never use more text than necessary.
  • Breathing room: every text element needs generous surrounding space
  • Body/features: small mono or geometric sans — functional, not decorative
  • Alignment: strict center or strict left — one system, perfectly maintained
  • Color: white on dark, black on white, one accent
  • Type LABELS the product — it does NOT compete with the product
  • Nothing font at fontWeight 300-400 feels Apple-minimal. Avoid bold for taglines.`,
  },

  "festival": {
    id: "festival",
    name: "Festival",
    references: "Coachella, Glastonbury, Tomorrowland, A24 music",
    font_display: ["Bebas Neue", "Oswald", "Barlow Condensed"],
    font_body:    ["Space Mono", "Inter"],
    headline_weight:     700,
    headline_case:       "uppercase",
    headline_line_height: 0.82,
    tracking_default:    -4,
    tracking_wide:        3,
    default_scale:       "monumental",
    interaction:         "text-in-negative-space",
    visual_weight_role:  "typography-hero",
    guidance: `FESTIVAL:
  • Title: condensed bold — Bebas Neue or Oswald — MONUMENTAL scale (120-200px)
  • tracking: -2 to -5px (tight, compressed, powerful — like a festival headliner announcement)
  • The title should feel like it was ANNOUNCED, not placed
  • lineHeight: 0.80-0.85 — lines almost touch, creating density and energy
  • Body / lineup: smaller but still present — Space Mono or condensed sans
  • Alignment: center for festival energy, hard left for underground/alternative
  • Make the event name ENORMOUS — it should be readable from 10 meters`,
  },

  "brutalist": {
    id: "brutalist",
    name: "Brutalist",
    references: "Experimental Jetset, Studio Dumbar, Werkplaats Typografie, Praxis",
    font_display: ["Bebas Neue", "Space Mono", "Impact"],
    font_body:    ["Space Mono", "Courier Prime"],
    headline_weight:     900,
    headline_case:       "uppercase",
    headline_line_height: 0.80,
    tracking_default:    -6,
    tracking_wide:       60,
    default_scale:       "monumental",
    interaction:         "oversized-cropped",
    visual_weight_role:  "typography-hero",
    guidance: `BRUTALIST:
  • Title: MAXIMUM scale — letterforms fill and sometimes BREAK the canvas (150-250px)
  • intentionally let text bleed off canvas edges: x may be negative, x+width may exceed canvas width
  • Tracking: either extremely tight (-4 to -8px) OR extremely wide (40-120px for drama)
  • The headline IS the design — image and shapes are secondary
  • Body text: monospace, functional, printed data, not decoration
  • This is CONFRONTATIONAL — type is aggressive, large, unapologetic
  • Use Space Mono for body — it reads as a functional system, not a style`,
  },

  "cinematic": {
    id: "cinematic",
    name: "Cinematic",
    references: "A24, Criterion Collection, NEON Films, Letterboxd",
    font_display: ["Playfair Display", "Cormorant Garamond", "Bebas Neue", "Oswald"],
    font_body:    ["Space Mono", "DM Mono"],
    headline_weight:     700,
    headline_case:       "title-case",
    headline_line_height: 0.95,
    tracking_default:     2,
    tracking_wide:        8,
    default_scale:       "large",
    interaction:         "text-over-image",
    visual_weight_role:  "balanced",
    guidance: `CINEMATIC:
  • Title: evocative — use either dramatic serif or bold condensed depending on genre
    Thriller/drama: Playfair Display or Cormorant italic
    Action/epic: Bebas Neue or Oswald
  • Scale: large to oversized (60-130px) — a TITLE CARD, not a label
  • Text placed in the dark atmospheric zones of the image — feel the depth
  • Tagline: smaller, italic or mono — below OR above the title
  • Tracking: 2-8px for drama
  • Color: white or cream against dark scene — high luminance contrast
  • The type must feel EARNED — placed at the last moment, precisely, with conviction`,
  },
};

// ─── Preset selection ─────────────────────────────────────────────────────────

export function selectTypographyPreset(
  pipeline: "product-exhibit" | "atmospheric-event" | "collage" | "preset-standard",
  category = "",
  mood = "",
): TypographyPreset {

  if (pipeline === "collage") return "brutalist";

  if (pipeline === "atmospheric-event") {
    const moodMap: Record<string, TypographyPreset> = {
      elegant:      "luxury-editorial",
      calm:         "luxury-editorial",
      academic:     "swiss-modern",
      futuristic:   "tech-minimal",
      underground:  "brutalist",
      experimental: "brutalist",
      cinematic:    "cinematic",
      energetic:    "festival",
      playful:      "festival",
    };
    if (mood && moodMap[mood]) return moodMap[mood];

    const typeMap: Record<string, TypographyPreset> = {
      exhibition:   "luxury-editorial",
      opening:      "luxury-editorial",
      workshop:     "swiss-modern",
      lecture:      "swiss-modern",
      conference:   "swiss-modern",
      student_show: "swiss-modern",
      screening:    "cinematic",
      performance:  "cinematic",
      festival:     "festival",
      concert:      "festival",
      party:        "festival",
      popup:        "swiss-modern",
    };
    if (category && typeMap[category]) return typeMap[category];
    return "festival";
  }

  if (pipeline === "product-exhibit") {
    const catMap: Record<string, TypographyPreset> = {
      beauty:   "luxury-editorial",
      luxury:   "luxury-editorial",
      fashion:  "luxury-editorial",
      art:      "luxury-editorial",
      book:     "cinematic",
      tech:     "tech-minimal",
      food:     "festival",
      beverage: "cinematic",
      toy:      "festival",
      home:     "swiss-modern",
      general:  "swiss-modern",
    };
    if (category && catMap[category]) return catMap[category];
    return "swiss-modern";
  }

  return "swiss-modern";
}

// ─── Campaign headline generation ─────────────────────────────────────────────
//
// The headline is NOT the product/event name.
// It is a campaign-style concept that sells the FEELING.

// Word-bank: maps source keywords → campaign words
const HEADLINE_WORD_MAP: Record<string, string[]> = {
  // Beauty / personal care
  hair:      ["AERO", "SILK", "FLOW", "WAVE", "WIND"],
  dryer:     ["AERO", "FLOW", "AIR", "WIND"],
  curl:      ["WAVE", "FORM", "BEND", "CURVE"],
  skin:      ["BARE", "PURE", "VEIL", "BLOOM"],
  glow:      ["RADIANCE", "LUMI", "AURA", "GLOW"],
  serum:     ["ELIXIR", "VEIL", "PURE", "ORIGIN"],
  cream:     ["VEIL", "CLOUD", "PURE", "SATIN"],
  perfume:   ["VEIL", "MIST", "AURA", "SILLAGE"],
  scent:     ["AURA", "VEIL", "MIST", "SILLAGE"],
  lipstick:  ["BOLD", "ROUGE", "EDGE", "MARK"],
  foundation:["BASE", "PURE", "BARE", "SECOND SKIN"],

  // Beverages
  coffee:    ["MORNING RITUAL", "ORIGIN", "AWAKEN", "DARK ARTS", "FIRST POUR"],
  espresso:  ["EXTRACTION", "ORIGIN", "DARK", "PURE"],
  tea:       ["STEEP", "CEREMONY", "STILL", "BLOOM"],
  beer:      ["CRAFT", "COLD", "PURE", "GROUND"],
  wine:      ["TERROIR", "VINTAGE", "ORIGIN", "STILL"],
  cocktail:  ["DARK ARTS", "ALCHEMY", "RITUAL", "MIX"],
  juice:     ["ORIGIN", "PURE", "PRESS", "COLD"],
  water:     ["PURE", "ORIGIN", "SOURCE", "STILL"],
  matcha:    ["CEREMONY", "STILL", "RITUAL", "ORIGIN"],
  latte:     ["RITUAL", "POUR", "SOFT", "MORNING"],

  // Food
  bread:     ["RISE", "CRAFT", "SLOW", "GROUND"],
  burger:    ["GROUND ZERO", "FIRE", "BUILT", "CRAFT"],
  pizza:     ["FIRE", "CRAFT", "GROUND", "BUILT"],
  cake:      ["LAYER", "CRAFT", "BLOOM", "RISE"],
  chocolate: ["ORIGIN", "DARK", "PURE", "DEPTH"],
  pasta:     ["FORM", "GATHER", "TABLE", "CRAFT"],
  sushi:     ["PRECISION", "STILL", "FORM", "PURE"],
  salad:     ["BLOOM", "ORIGIN", "GATHER", "FRESH"],

  // Tech
  phone:     ["SIGNAL", "PULSE", "EDGE", "ARC"],
  laptop:    ["EDGE", "CORE", "APEX", "FRAME"],
  headphone: ["SILENCE", "DEPTH", "PURE SOUND", "IMMERSE"],
  speaker:   ["RESONANCE", "WAVE", "PULSE", "SOUND"],
  camera:    ["FRAME", "CAPTURE", "STILL", "LENS"],
  watch:     ["PRECISION", "TIME", "MARK", "MOTION"],
  tablet:    ["SURFACE", "EDGE", "FRAME", "PORTAL"],

  // Fashion
  shoe:      ["GROUND", "STEP", "FORM", "EDGE"],
  sneaker:   ["GROUND ZERO", "EDGE", "STRIDE", "FORM"],
  jacket:    ["LAYER", "OUTER", "SHIELD", "FORM"],
  dress:     ["FORM", "DRAPE", "STILL", "EDIT"],
  bag:       ["CARRY", "FORM", "EDIT", "HOLD"],
  watch2:    ["MARK", "PRECISION", "TIME", "CRAFT"],

  // Home
  candle:    ["STILL", "GLOW", "LIGHT", "BURN"],
  lamp:      ["LIGHT", "GLOW", "STILL", "ARC"],
  chair:     ["FORM", "REST", "GROUND", "STILL"],
  table:     ["GATHER", "GROUND", "FORM", "TABLE"],

  // Events
  football:  ["FRIDAY NIGHT", "THE RIVALRY", "UNDER THE LIGHTS", "GAME DAY"],
  basketball:["RISE UP", "ABOVE THE RIM", "COURT VISION", "THE GAME"],
  music:     ["SOUND", "MOTION", "ELECTRIC", "THE FREQUENCY"],
  concert:   ["THE SOUND", "LIVE", "ELECTRIC", "ONE NIGHT"],
  film:      ["THE SCREENING", "REEL", "FRAMES", "DARK"],
  art:       ["FORM", "MATTER", "STILL", "LIGHT"],
  design:    ["FORM", "SYSTEM", "GRID", "STRUCTURE"],
};

// Fallback banks by category
const CATEGORY_FALLBACKS: Record<string, string[]> = {
  beauty:   ["AURA", "GLOW", "PURE", "RADIANCE", "BLOOM", "VEIL", "ELIXIR", "LUMI"],
  tech:     ["EDGE", "APEX", "CORE", "NEXUS", "PULSE", "ARC", "ZERO", "SIGNAL"],
  food:     ["CRAFT", "ORIGIN", "GATHER", "TABLE", "SEASON", "FIRE", "GROUND"],
  beverage: ["RITUAL", "ORIGIN", "PURE", "RISE", "DARK ARTS", "AWAKEN", "POUR"],
  fashion:  ["FORM", "EDIT", "MARK", "EDGE", "LINE", "STILL", "DRAPE"],
  luxury:   ["LEGACY", "HERITAGE", "OPUS", "ERA", "MAISON", "ATELIER", "CRAFT"],
  home:     ["SPACE", "FORM", "REST", "GROUND", "STILL", "LIGHT", "GATHER"],
  art:      ["FORM", "VOID", "MATTER", "LIGHT", "SHADOW", "MARK", "MOTION"],
  book:     ["CHAPTER", "OPEN", "VOICE", "MIND", "PAGE", "STORY"],
  toy:      ["WONDER", "PLAY", "IMAGINE", "EPIC", "QUEST", "JOY"],
  general:  ["FORM", "STORY", "VISION", "CRAFT", "PURE", "EDGE", "ORIGIN"],
};

/**
 * Generates a campaign-style headline suggestion from the concept.
 * This is deterministic and used as a prompt suggestion — GPT may improve on it.
 */
export function suggestCampaignHeadline(concept: string, category = "general"): string {
  const lower = (concept || "").toLowerCase();
  const words = lower.split(/[\s,\/\-_]+/).filter(w => w.length > 2);

  // Check word bank for direct matches
  for (const word of words) {
    for (const [key, options] of Object.entries(HEADLINE_WORD_MAP)) {
      if (word === key || word.startsWith(key) || key.startsWith(word)) {
        return options[0];
      }
    }
  }

  // Fallback to category bank — pick deterministically
  const bank = CATEGORY_FALLBACKS[category] ?? CATEGORY_FALLBACKS.general;
  const hash = concept.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return bank[hash % bank.length];
}

// ─── Interaction style descriptions ──────────────────────────────────────────

const INTERACTION_DESCRIPTIONS: Record<TypeInteraction, string> = {
  "text-behind-image":
    "Set title zIndex BELOW the product/image layer. The image visually cuts through the letterforms. " +
    "Example: title at zIndex 3, product at zIndex 4. The product partially occludes the text.",
  "text-in-negative-space":
    "Position the title in the compositional void — the clear zone of the canvas. " +
    "Usually top 20% or bottom 20% when the product occupies center. " +
    "The type should have breathing room — not crowded against other elements.",
  "oversized-cropped":
    "The title intentionally bleeds off canvas edges. x may be negative, (x+width) may exceed canvas width. " +
    "Only the visible portion of the letterforms shows. This creates scale and aggression. " +
    "At minimum, the first or last letter should be partially cropped.",
  "anchored-to-shape":
    "The title is positioned flush against or overlapping a geometric shape. " +
    "The shape's edge becomes the type's baseline or bounding edge. " +
    "The type and shape feel like one composed unit.",
  "text-over-image":
    "The title renders in the darker atmospheric zones of the background image. " +
    "Ensure a colorOverlay or overlay darkens the text zone so type is readable. " +
    "White or cream text on dark image zones creates cinematic depth.",
  "standard":
    "Conventional placement — type positioned in a clear zone with good contrast. " +
    "No special spatial relationship required.",
};

// ─── Main typography block builder ───────────────────────────────────────────

export interface TypographyContext {
  pipeline: "product-exhibit" | "atmospheric-event" | "collage" | "preset-standard";
  category?: string;    // product category or event type
  mood?: string;        // event mood or product mood
  concept: string;      // user's concept/name
  userTitle?: string;   // if user provided a specific title, respect it
}

export function buildTypographyBlock(ctx: TypographyContext): string {
  const preset     = PRESETS[selectTypographyPreset(ctx.pipeline, ctx.category, ctx.mood)];
  const suggestion = ctx.userTitle || suggestCampaignHeadline(ctx.concept, ctx.category);
  const fonts      = preset.font_display[0];
  const bodyFont   = preset.font_body[0];
  const interactionDesc = INTERACTION_DESCRIPTIONS[preset.interaction];

  const scaleGuide: Record<TypeScale, string> = {
    compact:    "14-28px",
    medium:     "32-54px",
    large:      "60-90px",
    oversized:  "100-140px",
    monumental: "150-240px",
  };

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TYPOGRAPHY DIRECTOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRESET: ${preset.name.toUpperCase()}
References: ${preset.references}

${preset.guidance}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CAMPAIGN HEADLINE (most critical instruction)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Do NOT use the literal product/event/category name as the poster headline.

Bad headlines: "Hair Dryer" / "Coffee" / "Football" / "Architecture Exhibition"
Good headlines: "AERO" / "MORNING RITUAL" / "FRIDAY NIGHT" / "FORM"

The headline sells the FEELING of the product/event, not its category.
It should be 1-4 words. Evocative. Confident. Unforgettable.

Suggested headline for "${ctx.concept}": "${suggestion}"
→ Use this or generate something stronger. ${ctx.userTitle ? "(User provided: always use user-provided title)" : ""}

The final headline goes into the title layer's textData.text field.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FONT PAIR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Display (headline/title): ${fonts}
Body (info/details/meta): ${bodyFont}
Return these in the "fonts" field.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TITLE TREATMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
fontFamily:    ${fonts}
fontWeight:    ${preset.headline_weight}
fontSize:      ${scaleGuide[preset.default_scale]} (${preset.default_scale})
letterSpacing: ${preset.tracking_default}px
lineHeight:    ${preset.headline_line_height}
textTransform: "${preset.headline_case === "uppercase" ? "uppercase" : "none"}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TYPE INTERACTION: ${preset.interaction.toUpperCase().replace(/-/g, " ")}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${interactionDesc}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISUAL WEIGHT ROLE: ${preset.visual_weight_role.toUpperCase().replace(/-/g, " ")}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${preset.visual_weight_role === "typography-hero"
  ? "Typography IS the primary visual element. Type scale and placement take precedence."
  : preset.visual_weight_role === "image-hero"
  ? "The image/product is the primary element. Typography SUPPORTS it — does not compete."
  : "Typography and image share equal visual weight. Each reinforces the other."}

Include "typography_preset": "${preset.id}" in your plan output.`;
}

// ─── Convenience getter ───────────────────────────────────────────────────────

export function getPreset(preset: TypographyPreset): PresetDef {
  return PRESETS[preset];
}

export { type PresetDef };
