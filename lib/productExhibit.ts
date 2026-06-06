/**
 * Product Exhibit — commercial product advertisement poster system.
 *
 * Works for any product category: food, beverage, beauty, fashion, tech,
 * home, art, book, toy, luxury, and general.
 *
 * Design principle: Background → Hero Product → Typography → Badge/CTA →
 *                   Trust Signals → Brand Signals → Visual Flow
 *
 * Architecture: GPT-4o generates both the ProductExhibitPlan (Director schema)
 * and the layer JSON in a single call. The plan drives Flux prompt generation.
 */

import type { PosterSetupConfig, CanvasConfig, DesignBrief } from "@/types/poster";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductCategory =
  | "food" | "beverage" | "beauty" | "fashion" | "tech"
  | "home" | "art" | "book" | "toy" | "luxury" | "general";

export type ProductLayout = "A" | "B" | "C" | "D" | "E" | "F";

export interface ProductExhibitPlan {
  module: "Product Exhibit";
  product_category: ProductCategory;
  poster_intent: "sell" | "launch" | "promote" | "gift" | "menu" | "showcase" | "announce";
  mood: "warm" | "premium" | "clean" | "playful" | "futuristic" | "handmade" | "elegant" | "bold";
  layout_variant: ProductLayout;
  background_system: {
    type: "solid" | "gradient" | "blurred_scene" | "tabletop" | "studio" | "texture" | "abstract";
    color_palette: string[];
    description: string;
  };
  hero_product: {
    placement: "center" | "center-lower" | "left" | "right" | "close-up";
    scale: string;
    lighting: "soft" | "dramatic" | "glossy" | "natural" | "studio";
    grounding: "shadow" | "reflection" | "surface" | "contact_shadow";
  };
  typography: {
    headline: string;
    headline_style: "bold-sans" | "serif" | "brush" | "editorial" | "modern" | "playful";
    tagline: string;
    details: string[];
    alignment: "left" | "center" | "right";
  };
  cta_or_offer: {
    type: "price_badge" | "launch_badge" | "feature_badge" | "shop_cta" | "label" | "none";
    text: string;
    placement: string;
  };
  trust_signals: Array<{ label: string; icon_style: string }>;
  brand_signals: Array<{ type: string; text: string }>;
  visual_flow: "Z-flow" | "triangle-flow" | "centered-editorial" | "split-layout";
  safe_margin_rules: {
    padding: string;
    prevent_text_overflow: boolean;
    prevent_product_corner_stack: boolean;
    preserve_layer_names: boolean;
    no_emoji_layer_names: boolean;
  };
}

// ─── Product category detection ───────────────────────────────────────────────

const CATEGORY_PATTERNS: [ProductCategory, RegExp][] = [
  ["food",     /\b(food|meal|dish|cook|bake|pizza|burger|pasta|sushi|soup|bread|cake|cookie|dessert|restaurant|menu|snack|sandwich|salad|ramen|noodle|steak|seafood|fruit|vegetable)\b/],
  ["beverage", /\b(drink|beverage|juice|coffee|tea|wine|beer|cocktail|smoothie|water|soda|lemonade|brew|espresso|boba|matcha|latte|spirits|whiskey|sake)\b/],
  ["beauty",   /\b(beauty|cosmetic|skincare|makeup|lipstick|perfume|cream|serum|moisturizer|foundation|skin|face|lotion|sunscreen|blush|mascara|cleanser|toner)\b/],
  ["fashion",  /\b(fashion|clothes|clothing|dress|shirt|pants|jacket|shoe|sneaker|bag|accessory|style|outfit|wear|apparel|garment|hat|belt|watch|jewel|necklace)\b/],
  ["tech",     /\b(tech|phone|laptop|computer|headphone|gadget|device|electronic|tablet|camera|speaker|wearable|smartwatch|drone|keyboard|monitor)\b/],
  ["home",     /\b(home|furniture|chair|table|lamp|decor|interior|kitchen|bathroom|bedroom|living|rug|curtain|vase|candle|towel|bedding|shelf|sofa)\b/],
  ["art",      /\b(art|painting|sculpture|print|artwork|gallery|artist|drawing|illustration|ceramic|pottery|sketch|canvas|craft)\b/],
  ["book",     /\b(book|novel|magazine|journal|notebook|publication|literature|story|comic|guide|manual|textbook)\b/],
  ["toy",      /\b(toy|game|play|kid|child|doll|puzzle|lego|board game|action figure|plush|figurine)\b/],
  ["luxury",   /\b(luxury|premium|exclusive|high.end|couture|designer|bespoke|artisan|fine|limited edition|prestige|heritage)\b/],
];

export function detectProductCategory(prompt: string): ProductCategory {
  const lower = prompt.toLowerCase();
  for (const [cat, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(lower)) return cat;
  }
  return "general";
}

// ─── Layout selection ─────────────────────────────────────────────────────────

const CATEGORY_PREFERRED_LAYOUT: Record<ProductCategory, ProductLayout> = {
  food:     "D",
  beverage: "D",
  beauty:   "F",
  fashion:  "B",
  tech:     "E",
  home:     "A",
  art:      "B",
  book:     "C",
  toy:      "A",
  luxury:   "B",
  general:  "A",
};

export function selectProductLayout(category: ProductCategory): ProductLayout {
  return CATEGORY_PREFERRED_LAYOUT[category];
}

// ─── Category-specific creative rules ────────────────────────────────────────

function getCategoryCreativeRules(category: ProductCategory, layout: ProductLayout): string {
  const rules: Record<ProductCategory, string> = {
    food: `
FOOD PRODUCT RULES:
  - Background: warm, appetizing — tabletop, kitchen counter, wooden surface, marble
  - Colors: amber, terracotta, cream, deep red, golden yellow, warm brown
  - Product: close-up showing texture, gloss, freshness, steam
  - Product placement: center or center-lower, filling 40-55% canvas
  - Typography: bold display (Bebas Neue, Playfair Display, Oswald) + clean sans (Inter, Lato)
  - Headline: appetite-driving language ("Freshly Made", "Just Baked", "Chef's Choice")
  - Badge: price badge or "Today's Special" or "Chef's Recommendation"
  - Trust signals: "Freshly Made", "Local Ingredients", "Slow Cooked", "Organic", "No Preservatives"
  - Flux prompt must include: warm lighting, food styling, surface texture, steam or condensation`,

    beverage: `
BEVERAGE PRODUCT RULES:
  - Background: bar counter, ice field, abstract liquid, deep saturated color, condensation surface
  - Colors: rich and saturated — deep blues, forest greens, warm reds, icy whites, golden tones
  - Product: tall and prominent, 40-50% canvas height, possibly with pour/splash/condensation
  - Typography: bold modern sans or elegant serif depending on brand tier
  - Badge: flavor badge, price badge, "New Flavor", "Limited Release"
  - Trust signals: "Natural Ingredients", "Cold Pressed", "No Added Sugar", "Craft Brewed"
  - Flux prompt must include: beverage photography style, ice/condensation/pour, dramatic lighting`,

    beauty: `
BEAUTY PRODUCT RULES:
  - Background: marble surface, soft gradient (blush/cream/white), vanity or studio, clean and premium
  - Colors: neutral palette — white, cream, blush pink, sage, powder blue, champagne
  - Product: centered with soft shadow/reflection beneath, 35-45% canvas
  - Typography: elegant serif (Cormorant Garamond, EB Garamond) + light sans (Raleway, Montserrat Light)
  - Headline: benefit-driven ("Pure. Radiant. Renewed.", "Skin Perfected")
  - Badge: ingredient badge or benefit badge (NOT a discount sticker) — "Vitamin C", "SPF 50"
  - Trust signals: "Dermatologist Tested", "Natural Formula", "Fragrance-Free", "Hydrating", "Clean Beauty"
  - Flux prompt: soft studio lighting, marble or white surface, product with subtle reflection`,

    fashion: `
FASHION PRODUCT RULES:
  - Background: clean editorial — solid white/grey/black, subtle paper texture, editorial gradient
  - Colors: restrained editorial palette — off-white, grey, black, or single accent color
  - Product: centered with strong negative space, 40-50% canvas
  - Typography: editorial serif (Bodoni, Playfair) + geometric sans (Futura, Montserrat)
  - Headline: evocative, minimal ("Wear the Season", "New Collection AW25")
  - Badge: collection label, season badge ("New Season", "SS25") — never a price sticker
  - Trust signals: "Premium Material", "Handcrafted", "Limited Edition", "New Collection"
  - Flux prompt: editorial fashion photography, clean background, perfect lighting`,

    tech: `
TECH PRODUCT RULES:
  - Background: dark or light studio gradient, clean geometry, subtle abstract field
  - Colors: dark + accent (midnight blue, charcoal, electric blue) OR clean white + accent
  - Product: sharp, crisp render, 40-50% canvas, studio reflections
  - Typography: clean geometric sans (Inter, DM Sans, Helvetica Neue)
  - Headline: concise + feature-driven ("Power meets design", "1000 songs in your pocket")
  - Feature pills/badges: battery life, processor speed, waterproof rating, new model year
  - Trust signals: key specifications as pills ("36h Battery", "4K Camera", "5G Ready")
  - Flux prompt: tech product photography, studio white or dark gradient, product renders`,

    home: `
HOME PRODUCT RULES:
  - Background: lifestyle scene — wood surface, linen, marble, interior setting, or clean gradient
  - Colors: natural, warm neutrals — warm white, oat, sand, clay, eucalyptus, muted terracotta
  - Product: placed in context (on a table, shelf, or surface), 40-50% canvas
  - Typography: warm serif (Playfair, Georgia) + clean sans (Inter, Open Sans)
  - Badge: "New Arrival", "Handcrafted", material quality badge
  - Trust signals: "Sustainable", "Handmade", "Durable", material origin
  - Flux prompt: lifestyle product photography, interior styling, warm natural light`,

    art: `
ART PRODUCT RULES:
  - Background: textured surface — paper, canvas, linen, aged wood, creative workspace
  - Colors: warm, natural, tactile — warm white, cream, aged paper, earth tones
  - Product: full visibility showing artwork detail and texture, 40-55% canvas
  - Typography: editorial with character (IM Fell English, Libre Baskerville, Playfair Display)
  - Badge: edition number, "Original", collection name — understated, elegant
  - Trust signals: "Artist Made", "Limited Edition", "Signed Original", "Archival Quality"
  - Flux prompt: artwork photography, natural light, textured surface, studio quality`,

    book: `
BOOK PRODUCT RULES:
  - Background: desk surface, linen, soft gradient, editorial clean environment
  - Colors: warm neutral or match book cover palette
  - Product: book cover prominently displayed, possibly at slight angle, 40-50% canvas
  - Typography: literary serif (Libre Baskerville, Georgia) + clean sans
  - Badge: review quote, "#1 Bestseller", "Award Winner", "New Release"
  - Trust signals: awards, reviews, publication info
  - Flux prompt: book photography, editorial desk scene, warm natural lighting`,

    toy: `
TOY PRODUCT RULES:
  - Background: bright, fun, playful — bold solid color, playroom feel, illustrated style
  - Colors: primary bold colors, high saturation
  - Product: dynamic placement, full visibility, 45-55% canvas
  - Typography: rounded, friendly, playful display font
  - Badge: "Award Winner", "Best Toy 2025", "Ages 3+", "Safe for Kids"
  - Trust signals: safety certifications, age range, award badges
  - Flux prompt: toy product photography, bright background, playful energy`,

    luxury: `
LUXURY PRODUCT RULES:
  - Background: deep solid tone or very subtle texture — black, navy, deep burgundy, ivory, champagne gold
  - Colors: premium, restrained — midnight, ivory, gold, deep wine, platinum
  - Product: center stage with ample breathing room, 35-45% canvas, perfect lighting
  - Typography: refined serif (Cormorant, Didot, Bodoni) + thin caps sans
  - Badge: ONLY small seal, monogram, or edition label — NEVER a price sticker or discount graphic
  - Trust signals: "Crafted in [Country]", "Limited to 500", "Since 1892", "Master Craftsman"
  - Flux prompt: luxury product photography, dramatic or soft studio lighting, premium surface`,

    general: `
GENERAL PRODUCT RULES:
  - Adapt the atmosphere to the product's personality from the concept description
  - Create a cohesive visual environment that supports the product
  - Clean hierarchy: headline → product → details → badge → trust signals
  - Background must support the product — never compete with it
  - Flux prompt: professional product photography, appropriate atmospheric background`,
  };

  return (rules[category] ?? rules.general) + `\n  PREFERRED LAYOUT VARIANT: ${layout}`;
}

// ─── System prompt ────────────────────────────────────────────────────────────

export function buildProductExhibitSystemPrompt(canvas: CanvasConfig): string {
  const W = canvas.width;
  const H = canvas.height;
  const PAD = Math.round(Math.min(W, H) * 0.05);

  return `You are a Senior Commercial Art Director specializing in product advertising.
You design high-quality product advertisement posters for any product category.

CANVAS: ${W}×${H}px | SAFE MARGINS: ${PAD}px all sides
Every layer's visible content must stay within these bounds.

─── LAYER NAMING CONVENTION (MANDATORY) ───────────────────────────────────────
Use ONLY these semantic names. No emoji. No single letters. No random names.

  background/base          → solidBackground (full canvas, zIndex 0)
  background/texture       → noiseTexture or textureLayer (optional)
  background/gradient      → gradientLayer (optional, above base)
  product/hero             → backgroundImage (main product, with clipShape)
  product/shadow           → geometricShape (shadow/ground below product)
  text/headline            → titleText (primary headline)
  text/tagline             → subtitleText
  text/details             → bodyText (1-3 detail lines)
  text/cta                 → userText (call-to-action text)
  badge/offer              → geometricShape + metaText (circle or rounded rect)
  badge/feature-01         → geometricShape (feature pill)
  trust/icon-01            → accentLine or metaText (trust signal)
  trust/label-01           → metaText (trust label)
  brand/seal               → geometricShape (small circle/stamp shape)
  brand/decorative-line    → accentLine
  brand/logo-placeholder   → logoPlaceholder

─── LAYOUT VARIANTS ────────────────────────────────────────────────────────────
A  Classic Hero          headline top, product center-lower, badge right, trust bottom
B  Premium Editorial     product centered, large negative space, minimal headline, small brand
C  Split Feature         product left/right, headline+features opposite side, CTA badge
D  Food Hero Ad          warm bg, large product filling frame, bold headline, price badge, trust icons
E  Modern Tech Launch    gradient bg, sharp product, concise headline, 2-3 feature pills
F  Beauty/Lifestyle      soft gradient, centered product with reflection, elegant serif, ingredient badge

─── BACKGROUND RULES ───────────────────────────────────────────────────────────
• background/base MUST always exist, MUST cover full canvas (x:0,y:0,w:${W},h:${H}), zIndex:0
• Never leave the canvas blank or transparent
• Background must support the product emotionally without overpowering it
• Use large color masses, never random small decorations on the background
• A noiseTexture layer (opacity 0.03-0.07) adds tactile warmth when appropriate

─── HERO PRODUCT RULES ─────────────────────────────────────────────────────────
• Product MUST be the main visual anchor, occupying 35-55% canvas
• Place it intentionally: center-lower (A,D,E,F), centered (B,F), side (C)
• NEVER dump the product in the top-left corner
• ALWAYS include a clipShape on the product layer to contain it in its zone
• Add a product/shadow layer (geometricShape, low opacity ~0.15-0.3) below the product
• Product must have clear contrast from background

─── TYPOGRAPHY RULES ───────────────────────────────────────────────────────────
• Hierarchy: headline >>> tagline >> details (ratio at minimum 2:1:0.5)
• All text must stay within safe margins: x≥${PAD}, y≥${PAD}, x+w≤${W-PAD}, y+h≤${H-PAD}
• Headline fontSize: 52-120px. Tagline: 18-36px. Details: 12-20px.
• Maximum 3 type sizes on one poster
• Text must not fight with the product for attention — position in negative space

─── BADGE/TRUST/BRAND RULES ────────────────────────────────────────────────────
• badge/offer: create a secondary focal point. Circles, capsules, or small cards.
  Never cover the product's focal area. Positions: upper-right, mid-right, lower-right.
• trust signals: 2-4 small signals. Row at bottom, side column, or small pills.
  Make them readable. Font size minimum 11px.
• brand signals: small, understated. Seal, decorative line, logo placeholder.

─── FLUX PROMPT RULES ──────────────────────────────────────────────────────────
Write an 80-120 word atmospheric scene description for Flux image generation.
Include: background atmosphere + product placement + lighting + surface.
Do NOT mention text, typography, or layout in the Flux prompt.
Make the scene match the product category's emotional atmosphere.

Return ONLY valid JSON. No markdown. No code fences.`;
}

// ─── User prompt ──────────────────────────────────────────────────────────────

export function buildProductExhibitUserPrompt(
  setup: PosterSetupConfig,
  canvas: CanvasConfig,
  brief: DesignBrief | undefined,
  category: ProductCategory,
  layout: ProductLayout,
): string {
  const W = canvas.width;
  const H = canvas.height;
  const PAD = Math.round(Math.min(W, H) * 0.05);
  const concept = setup.prompt || "product";
  const lang = setup.language ?? "en";

  // Zone constraints per layout variant
  const zones = getLayoutZones(layout, W, H, PAD);
  const briefSection = brief
    ? `\nDESIGN BRIEF:\n  Mood: ${brief.mood}\n  Composition: ${brief.composition}\n  Typography: ${brief.typographyStrategy}\n  Note: ${brief.designRationale ?? "n/a"}`
    : "";

  return `Design a commercial product advertisement poster.

PRODUCT: "${concept}"
CATEGORY: ${category} | LAYOUT: ${layout} | LANGUAGE: ${lang}
CANVAS: ${W}×${H}px | SAFE MARGINS: ${PAD}px
${briefSection}

${getCategoryCreativeRules(category, layout)}

─── LAYOUT ${layout} ZONE CONSTRAINTS (use these coordinate ranges) ─────────────
${zones}

─── GENERATE THIS EXACT JSON STRUCTURE ─────────────────────────────────────────
{
  "plan": {
    "module": "Product Exhibit",
    "product_category": "${category}",
    "poster_intent": "sell | launch | promote | showcase | announce",
    "mood": "warm | premium | clean | playful | futuristic | handmade | elegant | bold",
    "layout_variant": "${layout}",
    "background_system": {
      "type": "solid | gradient | blurred_scene | tabletop | studio | texture | abstract",
      "color_palette": ["#hex1", "#hex2", "#hex3"],
      "description": "how this background supports the ${category} product"
    },
    "hero_product": {
      "placement": "center | center-lower | left | right | close-up",
      "scale": "40% canvas",
      "lighting": "soft | dramatic | glossy | natural | studio",
      "grounding": "shadow | reflection | surface | contact_shadow"
    },
    "typography": {
      "headline": "compelling product headline for '${concept}'",
      "headline_style": "bold-sans | serif | brush | editorial | modern | playful",
      "tagline": "short emotional or benefit tagline",
      "details": ["detail 1", "detail 2"],
      "alignment": "left | center | right"
    },
    "cta_or_offer": {
      "type": "price_badge | launch_badge | feature_badge | shop_cta | label | none",
      "text": "badge or CTA text",
      "placement": "upper-right | mid-right | lower-right | bottom"
    },
    "trust_signals": [{ "label": "quality signal", "icon_style": "pill | seal | minimal" }],
    "brand_signals": [{ "type": "stamp | logo_placeholder | decorative_line", "text": "brand text" }],
    "visual_flow": "Z-flow | triangle-flow | centered-editorial | split-layout",
    "safe_margin_rules": {
      "padding": "${PAD}px", "prevent_text_overflow": true,
      "prevent_product_corner_stack": true, "preserve_layer_names": true, "no_emoji_layer_names": true
    }
  },

  "layers": [
    REQUIRED LAYER 1 — background/base:
    { "id": "<uuid>", "type": "solidBackground", "label": "background/base",
      "x": 0, "y": 0, "width": ${W}, "height": ${H}, "zIndex": 0,
      "rotation": 0, "opacity": 1, "visible": true, "locked": false,
      "shapeData": { "shapeType": "rect", "fill": "<bg color>", "stroke": "none", "strokeWidth": 0 } },

    REQUIRED LAYER 2 — product/hero (backgroundImage with clipShape):
    { "id": "<uuid>", "type": "backgroundImage", "label": "product/hero",
      "x": <see zones>, "y": <see zones>, "width": <35-55%W>, "height": <proportional>,
      "zIndex": 2, "rotation": 0, "opacity": 1, "visible": true, "locked": false,
      "imageData": { "src": "", "fit": "cover" },
      "clipShape": { "type": "rect", "x": <px>, "y": <px>, "width": <px>, "height": <px> } },

    OPTIONAL — product/shadow below product (geometricShape, opacity 0.15-0.25):
    { "type": "geometricShape", "label": "product/shadow", "zIndex": 1,
      "shapeData": { "shapeType": "rect", "fill": "#000000", "stroke": "none", "strokeWidth": 0 } },

    REQUIRED LAYER 3 — text/headline:
    { "id": "<uuid>", "type": "titleText", "label": "text/headline",
      "x": <≥${PAD}>, "y": <see zones>, "width": <≤${W - PAD * 2}>, "height": <auto>,
      "zIndex": 6, "rotation": 0, "opacity": 1, "visible": true, "locked": false,
      "textData": { "text": "<from plan.typography.headline>", "fontSize": 60-120,
        "fontFamily": "<category-appropriate font>", "fontWeight": "700", "fontStyle": "normal",
        "fill": "<high contrast color>", "align": "<from plan>",
        "letterSpacing": 0, "lineHeight": 1.1, "textTransform": "none" } },

    REQUIRED LAYER 4 — text/tagline:
    { "type": "subtitleText", "label": "text/tagline",
      "textData": { "text": "<tagline>", "fontSize": 18-28, ... } },

    OPTIONAL — text/details (1-3 bodyText layers):
    { "type": "bodyText", "label": "text/details", "fontSize": 14-20 },

    OPTIONAL — badge/offer (geometricShape + text/cta if needed):
    { "type": "geometricShape", "label": "badge/offer", "zIndex": 7,
      "shapeData": { "shapeType": "circle" or "rect", "fill": "<accent color>" } },

    OPTIONAL — trust signals (2-4 metaText or accentLine layers):
    { "type": "metaText", "label": "trust/label-01", "fontSize": 11-14 },

    OPTIONAL — brand signals:
    { "type": "geometricShape", "label": "brand/seal", "zIndex": 5 },
    { "type": "accentLine", "label": "brand/decorative-line" },

    OPTIONAL — noiseTexture (adds warmth/tactility):
    { "type": "noiseTexture", "label": "background/texture", "x": 0, "y": 0,
      "width": ${W}, "height": ${H}, "zIndex": 1, "opacity": 0.04 }
  ],

  "fonts": { "display": "<chosen display font>", "body": "<chosen body font>" },
  "palette": { "dominant": "#hex", "secondary": "#hex", "accent": "#hex", "background": "#hex" },
  "fluxPrompt": "<80-120 word atmospheric product scene description — NO text/typography mentions>",
  "designRationale": "2 sentences: key visual decision and why it serves the product"
}

ABSOLUTE REQUIREMENTS:
1. background/base MUST be the first layer (zIndex 0), MUST cover full canvas
2. product/hero MUST use coordinates from the ${layout} zones above — NOT top-left corner
3. All text layers MUST stay within safe margins (≥${PAD}px from all edges)
4. NO emoji in any layer label
5. Layer labels MUST follow the naming convention (background/..., product/..., text/..., badge/..., trust/..., brand/...)
6. fluxPrompt MUST describe the scene atmosphere (${category} appropriate), 80-120 words`;
}

// ─── Layout zone constraints ──────────────────────────────────────────────────

function getLayoutZones(layout: ProductLayout, W: number, H: number, PAD: number): string {
  const zones: Record<ProductLayout, string> = {
    A: `Layout A — Classic Hero:
  product/hero:      x: ${Math.round(W*0.10)}-${Math.round(W*0.55)}, y: ${Math.round(H*0.28)}-${Math.round(H*0.50)}, width: ${Math.round(W*0.38)}-${Math.round(W*0.50)}, height: ${Math.round(H*0.45)}-${Math.round(H*0.65)}
  text/headline:     x: ${PAD}-${Math.round(W*0.50)}, y: ${PAD}-${Math.round(H*0.25)}, width: max ${Math.round(W*0.55)}
  text/tagline:      below headline, y: ${Math.round(H*0.20)}-${Math.round(H*0.34)}
  text/details:      left column or below tagline
  badge/offer:       x: ${Math.round(W*0.62)}-${Math.round(W*0.88)}, y: ${Math.round(H*0.20)}-${Math.round(H*0.45)}
  trust signals:     x: ${PAD}, y: ${Math.round(H*0.82)}-${Math.round(H*0.93)} (bottom row)`,

    B: `Layout B — Premium Editorial (centered product, large negative space):
  product/hero:      x: ${Math.round(W*0.20)}-${Math.round(W*0.35)}, y: ${Math.round(H*0.18)}-${Math.round(H*0.32)}, width: ${Math.round(W*0.40)}-${Math.round(W*0.55)}, height: ${Math.round(H*0.45)}-${Math.round(H*0.65)}
  text/headline:     x: ${PAD}-${Math.round(W*0.45)}, y: ${Math.round(H*0.72)}-${Math.round(H*0.84)}, width: max ${Math.round(W*0.55)}
  text/tagline:      below headline, y: ${Math.round(H*0.82)}-${Math.round(H*0.90)}
  text/details:      y: ${Math.round(H*0.87)}-${Math.round(H*0.94)}
  badge/offer:       x: ${Math.round(W*0.72)}-${Math.round(W*0.88)}, y: ${PAD}-${Math.round(H*0.16)}
  brand/seal:        corner, very small`,

    C: `Layout C — Split Feature (product one side, text other side):
  product/hero:      x: ${PAD}, y: ${Math.round(H*0.10)}, width: ${Math.round(W*0.44)}-${Math.round(W*0.50)}, height: ${Math.round(H*0.70)}-${Math.round(H*0.85)}
  text/headline:     x: ${Math.round(W*0.52)}-${Math.round(W*0.54)}, y: ${PAD}-${Math.round(H*0.30)}, width: ${Math.round(W*0.43)}
  text/tagline:      x: ${Math.round(W*0.52)}, y: ${Math.round(H*0.28)}-${Math.round(H*0.38)}
  text/details:      x: ${Math.round(W*0.52)}, y: ${Math.round(H*0.40)}-${Math.round(H*0.65)}
  badge/offer:       x: ${Math.round(W*0.55)}-${Math.round(W*0.80)}, y: ${Math.round(H*0.68)}-${Math.round(H*0.82)}
  trust signals:     x: ${Math.round(W*0.52)}, y: ${Math.round(H*0.82)}-${Math.round(H*0.93)}`,

    D: `Layout D — Food Hero (product fills frame, bold top headline):
  product/hero:      x: ${Math.round(W*0.08)}, y: ${Math.round(H*0.28)}, width: ${Math.round(W*0.55)}-${Math.round(W*0.65)}, height: ${Math.round(H*0.55)}-${Math.round(H*0.68)}
  text/headline:     x: ${PAD}, y: ${PAD}-${Math.round(H*0.22)}, width: max ${Math.round(W*0.70)}, fontSize: 70-120px
  text/tagline:      x: ${PAD}, y: ${Math.round(H*0.20)}-${Math.round(H*0.28)}
  badge/offer:       x: ${Math.round(W*0.62)}-${Math.round(W*0.88)}, y: ${Math.round(H*0.22)}-${Math.round(H*0.50)} (right side, prominent)
  trust signals:     x: ${PAD}, y: ${Math.round(H*0.84)}-${Math.round(H*0.94)} (bottom row)`,

    E: `Layout E — Modern Tech Launch (gradient bg, top headline, feature pills):
  product/hero:      x: ${Math.round(W*0.12)}-${Math.round(W*0.20)}, y: ${Math.round(H*0.32)}-${Math.round(H*0.42)}, width: ${Math.round(W*0.48)}-${Math.round(W*0.58)}, height: ${Math.round(H*0.45)}-${Math.round(H*0.60)}
  text/headline:     x: ${PAD}, y: ${PAD}-${Math.round(H*0.22)}, width: max ${Math.round(W*0.65)}, fontSize: 60-90px
  text/tagline:      x: ${PAD}, y: ${Math.round(H*0.18)}-${Math.round(H*0.26)}
  badge/offer (feature pill): ${Math.round(W*0.60)}-${Math.round(W*0.88)}, y: ${Math.round(H*0.18)}-${Math.round(H*0.38)} (2-3 pills stacked)
  trust signals:     x: ${PAD}, y: ${Math.round(H*0.84)}-${Math.round(H*0.94)}`,

    F: `Layout F — Beauty/Lifestyle (soft gradient, centered product, elegant text):
  product/hero:      x: ${Math.round(W*0.15)}-${Math.round(W*0.25)}, y: ${Math.round(H*0.16)}-${Math.round(H*0.22)}, width: ${Math.round(W*0.42)}-${Math.round(W*0.52)}, height: ${Math.round(H*0.52)}-${Math.round(H*0.65)}
  text/headline:     x: ${PAD}, y: ${PAD}-${Math.round(H*0.14)}, width: max ${Math.round(W - PAD*2)}
  text/tagline:      centered, y: ${Math.round(H*0.78)}-${Math.round(H*0.86)}
  text/details:      centered, y: ${Math.round(H*0.85)}-${Math.round(H*0.92)}
  badge/offer:       x: ${Math.round(W*0.62)}-${Math.round(W*0.86)}, y: ${Math.round(H*0.22)}-${Math.round(H*0.42)} (ingredient/benefit badge)
  trust signals:     bottom, y: ${Math.round(H*0.92)}-${Math.round(H*0.96)}`,
  };
  return zones[layout];
}

// ─── Demo plan (no API key) ───────────────────────────────────────────────────

export function buildDemoProductExhibitPlan(concept: string): ProductExhibitPlan {
  const category = detectProductCategory(concept);
  const layout = selectProductLayout(category);
  return {
    module:            "Product Exhibit",
    product_category:  category,
    poster_intent:     "showcase",
    mood:              "bold",
    layout_variant:    layout,
    background_system: { type:"solid", color_palette:["#1a1a1a","#2d2d2d","#f5c400"], description:"Dark professional studio backdrop" },
    hero_product:      { placement:"center", scale:"45% canvas", lighting:"studio", grounding:"shadow" },
    typography:        { headline:concept || "PRODUCT", headline_style:"bold-sans", tagline:"Discover the difference", details:["Premium quality","Handcrafted"], alignment:"left" },
    cta_or_offer:      { type:"launch_badge", text:"New Arrival", placement:"upper-right" },
    trust_signals:     [{ label:"Premium Quality", icon_style:"pill" }, { label:"Handcrafted", icon_style:"seal" }],
    brand_signals:     [{ type:"decorative_line", text:"—" }],
    visual_flow:       "Z-flow",
    safe_margin_rules: { padding:"5%", prevent_text_overflow:true, prevent_product_corner_stack:true, preserve_layer_names:true, no_emoji_layer_names:true },
  };
}

// ─── Export the plan type for use in layout route ─────────────────────────────

export type { ProductExhibitPlan as Plan };
