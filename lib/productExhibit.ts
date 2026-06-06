/**
 * Product Exhibit — commercial product advertisement poster system.
 *
 * Works for any product category: food, beverage, beauty, fashion, tech,
 * home, art, book, toy, luxury, and general.
 *
 * Design principle: PRODUCT IS THE HERO.
 * Product visual area > Headline > Features > Brand.
 * The viewer must identify the product in 1 second.
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
    placement: "center" | "center-lower" | "left" | "right" | "close-up" | "full-bleed";
    scale: string;
    lighting: "soft" | "dramatic" | "glossy" | "natural" | "studio";
    grounding: "shadow" | "reflection" | "surface" | "contact_shadow" | "floating";
  };
  typography: {
    headline: string;
    headline_style: "bold-sans" | "serif" | "brush" | "editorial" | "modern" | "playful";
    tagline: string;
    features: string[];
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
  commercial_ad_test: {
    product_visible_in_1s: boolean;
    product_benefit_in_3s: boolean;
    feels_like_real_ad: boolean;
  };
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
  ["food",     /\b(food|meal|dish|cook|bake|pizza|burger|pasta|sushi|soup|bread|cake|cookie|dessert|restaurant|menu|snack|sandwich|salad|ramen|noodle|steak|seafood|fruit|vegetable)\b/i],
  ["beverage", /\b(drink|beverage|juice|coffee|tea|wine|beer|cocktail|smoothie|water|soda|lemonade|brew|espresso|boba|matcha|latte|spirits|whiskey|sake)\b/i],
  ["beauty",   /\b(beauty|cosmetic|skincare|makeup|lipstick|perfume|cream|serum|moisturizer|foundation|skin|face|lotion|sunscreen|blush|mascara|cleanser|toner|hair|dryer|curl|brush)\b/i],
  ["fashion",  /\b(fashion|clothes|clothing|dress|shirt|pants|jacket|shoe|sneaker|bag|accessory|style|outfit|wear|apparel|garment|hat|belt|watch|jewel|necklace)\b/i],
  ["tech",     /\b(tech|phone|laptop|computer|headphone|gadget|device|electronic|tablet|camera|speaker|wearable|smartwatch|drone|keyboard|monitor)\b/i],
  ["home",     /\b(home|furniture|chair|table|lamp|decor|interior|kitchen|bathroom|bedroom|living|rug|curtain|vase|candle|towel|bedding|shelf|sofa)\b/i],
  ["art",      /\b(art|painting|sculpture|print|artwork|gallery|artist|drawing|illustration|ceramic|pottery|sketch|canvas|craft)\b/i],
  ["book",     /\b(book|novel|magazine|journal|notebook|publication|literature|story|comic|guide|manual|textbook)\b/i],
  ["toy",      /\b(toy|game|play|kid|child|doll|puzzle|lego|board game|action figure|plush|figurine)\b/i],
  ["luxury",   /\b(luxury|premium|exclusive|high.end|couture|designer|bespoke|artisan|fine|limited edition|prestige|heritage)\b/i],
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
  food:     "D",  // Full bleed — food fills the frame
  beverage: "D",  // Full bleed — bottle/cup fills the frame
  beauty:   "F",  // Beauty centered — centered product, elegant text strip
  fashion:  "B",  // Premium editorial — product right column, copy left
  tech:     "E",  // Feature breakdown — product left, specs right
  home:     "A",  // Hero close-up — large lifestyle product
  art:      "B",  // Premium editorial — artwork right, copy left
  book:     "C",  // Commercial launch — book cover center, info right
  toy:      "A",  // Hero close-up — playful, product big
  luxury:   "B",  // Premium editorial — restrained, product dominant
  general:  "A",  // Hero close-up — safe default
};

export function selectProductLayout(category: ProductCategory): ProductLayout {
  return CATEGORY_PREFERRED_LAYOUT[category];
}

// ─── Category-specific staging worlds ────────────────────────────────────────
//
// Every category gets a SPECIFIC WORLD that communicates the product's benefit.
// Not a generic studio. A designed environment.

function getCategoryCreativeRules(category: ProductCategory, layout: ProductLayout): string {
  const rules: Record<ProductCategory, string> = {
    food: `
FOOD PRODUCT RULES:
  STAGING WORLD: The product lives in its ideal moment — a restaurant counter, a warm kitchen, a marble tabletop. Steam rises. Sauces glisten. Textures are sharp and inviting.
  ENVIRONMENT: tabletop, kitchen, warm ambient light, food-styling arrangement, props (herbs, sauce drizzle, steam)
  COLORS: amber, terracotta, cream, deep red, golden yellow, warm brown
  PRODUCT SCALE: product must fill 50-70% of canvas. Food is appetite. Make it ENORMOUS.
  HEADLINE: appetite-driven, emotional, 3-6 words max. "Freshly Made", "Just Baked", "Hand-Crafted Daily"
  FEATURES (2-4): "Freshly Made Daily" / "Local Ingredients" / "Slow Cooked 8h" / "Chef's Recipe"
  BADGE: price or special ("$12.90" or "Chef's Special" or "Today Only")
  FLUX PROMPT: Close-up food photography of [product] on [surface]. Steam or condensation. Warm studio lighting from upper-left. Rich colors. Appetizing texture detail. Shallow depth of field. No text. Advertising quality.`,

    beverage: `
BEVERAGE PRODUCT RULES:
  STAGING WORLD: The bottle/cup is a hero object — ice, condensation, pour, splash create movement and desire. The surface tells a story.
  ENVIRONMENT: ice field, bar counter, pour motion, condensation beads, dark dramatic backdrop or saturated color
  COLORS: depends on product — dark + gold (spirits), fresh white + green (juice), warm amber (beer), electric tones (soda)
  PRODUCT SCALE: product must fill 55-75% of canvas height. Bottle/cup must be the focal object.
  HEADLINE: flavor/feeling-driven. "Crafted for Moments" / "Pure Energy" / "Est. 1892"
  FEATURES (2-4): "Natural Ingredients" / "Cold Pressed" / "0g Sugar" / "Craft Brewed"
  BADGE: flavor, limited release, or edition label
  FLUX PROMPT: [Product name] bottle/glass in [environment — ice, dark bar, saturated backdrop]. [Specific effect — condensation/pour/splash]. Dramatic single-source lighting. [Color palette]. Ultra-sharp product. No text. Commercial advertising quality.`,

    beauty: `
BEAUTY PRODUCT RULES:
  STAGING WORLD: The product is an object of desire. Clean marble, soft gradients, delicate botanical props. Everything whispers "luxury" and "precision."
  ENVIRONMENT: marble surface, soft gradient backdrop (blush/ivory/sage/pearl), botanical props (petals, herbs), glass reflections
  COLORS: neutral premium palette — cream, ivory, blush pink, sage, powder blue, champagne gold
  PRODUCT SCALE: product centered, fills 55-70% canvas. The product must look expensive and precise.
  HEADLINE: benefit-driven, 3-5 words. "Pure Radiance" / "Precision Perfected" / "Skin Renewed"
  FEATURES (2-4): "Dermatologist Tested" / "Vitamin C Complex" / "SPF 50+" / "24h Hydration"
  BADGE: key ingredient, benefit, or certification (not discount)
  FLUX PROMPT: [Beauty product] on [marble/glass/botanical surface]. Soft window lighting from left. Subtle reflection beneath product. [Color palette — cream, blush, sage]. Fine mist or water droplets suggestion. Elegant editorial advertising quality. No text.`,

    fashion: `
FASHION PRODUCT RULES:
  STAGING WORLD: Clean editorial — the product is the sole statement. Dramatic negative space. The object speaks for itself.
  ENVIRONMENT: clean white, gray, or black backdrop — no clutter. Subtle fabric texture. Editorial photography style.
  COLORS: editorial neutral — off-white, grey, black, or one bold accent color
  PRODUCT SCALE: product fills 50-65% canvas. Strong negative space is intentional luxury.
  HEADLINE: minimal, evocative, 2-4 words. "New Season" / "Wear the Edge" / "AW25 Collection"
  FEATURES (2-3): "Premium Leather" / "Handcrafted" / "Limited Edition"
  BADGE: season or collection label — NOT a price sticker
  FLUX PROMPT: [Fashion item] on clean [white/gray/black] background. Editorial fashion photography. Perfect lighting, no shadows. [Color accent]. Crisp detail. Commercial photography quality. No text.`,

    tech: `
TECH PRODUCT RULES:
  STAGING WORLD: The device floats in a premium environment that communicates precision and capability. Studio reflections, geometric shadows, dark gradient backgrounds create the sense of a product launch.
  ENVIRONMENT: dark gradient studio (midnight blue to black), clean white studio, or geometric light reflections
  COLORS: dark base + electric accent (midnight, charcoal, electric blue) OR clean white + accent
  PRODUCT SCALE: product fills 50-65% canvas. Must show the device clearly and completely.
  HEADLINE: feature-driven, bold, 3-6 words. "Power Redefined" / "1000 Songs. One Device."
  FEATURES (3-5): core specs as feature pills ("36h Battery" / "4K Camera" / "5G Ready" / "IP68 Rated")
  BADGE: model year, capacity, or rating
  FLUX PROMPT: [Tech device] floating above [dark gradient surface / white studio floor]. Dramatic upward-angle studio lighting. [Electric accent glow]. Ultra-sharp product renders. Reflective surface beneath. Advertising quality. No text.`,

    home: `
HOME PRODUCT RULES:
  STAGING WORLD: The product lives in a real human space — a warm living room, a styled kitchen shelf, a Sunday morning table. Life is implied.
  ENVIRONMENT: lifestyle scene — wood surface, linen, marble, cozy interior, warm natural light from a window
  COLORS: warm naturals — warm white, oat, sand, clay, eucalyptus, muted terracotta
  PRODUCT SCALE: product fills 50-65% canvas, placed in context on a surface
  HEADLINE: lifestyle-driven, warm. "Made to Last" / "Designed for Living" / "Home Reimagined"
  FEATURES (2-4): "Solid Oak" / "Handmade" / "Sustainably Sourced" / "10-Year Warranty"
  BADGE: new arrival, material, or award label
  FLUX PROMPT: [Home product] in warm lifestyle setting — [wood table / marble shelf / linen surface]. Soft natural window light from left. Warm tones. Cozy atmosphere. Styling props. Editorial lifestyle photography quality. No text.`,

    art: `
ART PRODUCT RULES:
  STAGING WORLD: The artwork is displayed with reverence — gallery wall, artist table, textured linen surface. It must look like it belongs in a collection.
  ENVIRONMENT: gallery white wall, textured paper, aged linen, artist's studio with natural light
  COLORS: warm neutral — warm white, cream, aged paper, earth tones
  PRODUCT SCALE: artwork fills 55-70% canvas, showing full work with texture visible
  HEADLINE: collector-tone, thoughtful. "Limited Edition" / "Artist Proof No. 12" / "Original Works"
  FEATURES (2-3): "Original" / "Signed by Artist" / "Archival Paper" / "Limited to 50"
  BADGE: edition number, collection name, year
  FLUX PROMPT: [Artwork type] displayed on [gallery wall / linen / textured surface]. Soft natural museum-quality lighting. Texture visible. Warm neutral tones. Elegant collector atmosphere. No text.`,

    book: `
BOOK PRODUCT RULES:
  STAGING WORLD: The cover is the hero — displayed at a slight angle on a desk, with pen, coffee cup, or minimal props suggesting the reading experience.
  ENVIRONMENT: editorial desk, warm linen, coffee cup nearby, soft morning light
  COLORS: match book cover palette or warm neutral backdrop
  PRODUCT SCALE: book cover fills 55-65% canvas — the cover must be legible
  HEADLINE: review-style or launch copy. "This Season's Essential Read" / "#1 New Release"
  FEATURES (2-3): review quote, publisher, award label
  BADGE: bestseller list, award, or review quote
  FLUX PROMPT: [Book title] book displayed at slight angle on [desk/linen/wood surface]. Warm editorial morning light. Minimal props — coffee cup, pen. Cozy intellectual atmosphere. Cover clearly visible. Advertising quality. No text.`,

    toy: `
TOY PRODUCT RULES:
  STAGING WORLD: The toy is mid-action — movement implied, color exploding, joy radiating. Bright, bold, energetic.
  ENVIRONMENT: bright solid color backdrop, playroom energy, colorful props
  COLORS: primary bold colors, high saturation, joy
  PRODUCT SCALE: toy fills 55-65% canvas — large and playful
  HEADLINE: playful, exciting. "Adventure Awaits!" / "Imagination Unlimited" / "Play All Day"
  FEATURES (2-3): "Ages 3+" / "Award Winner 2025" / "BPA-Free" / "100+ Pieces"
  BADGE: age range, safety seal, award
  FLUX PROMPT: [Toy name] against bright [color] background. Dynamic placement suggesting play. Colorful props. Cheerful studio lighting. Bold saturated colors. Advertising quality. No text.`,

    luxury: `
LUXURY PRODUCT RULES:
  STAGING WORLD: The product exists in a world of restraint and precision — deep backgrounds, dramatic lighting, absolute silence. Nothing competes with the object.
  ENVIRONMENT: matte black, deep navy, charcoal, or ivory — no pattern, no clutter. Just the object and light.
  COLORS: midnight, ivory, gold, deep wine, platinum — never more than 2 colors + product
  PRODUCT SCALE: product fills 50-60% canvas with ample breathing room — negative space IS luxury
  HEADLINE: 2-3 words maximum, elegant. "Since 1847" / "Handcrafted Excellence" / "Maison X"
  FEATURES (2-3): "Crafted in Switzerland" / "Limited to 200" / "Master Craftsman" — NO price stickers
  BADGE: ONLY small monogram, edition seal, or year mark — never discount graphics
  FLUX PROMPT: [Luxury product] against [matte black / deep charcoal / ivory] backdrop. Single dramatic spotlight from 45° upper-left. Deep shadow. Product surface detail visible. Extreme stillness. Ultra-luxury editorial advertising quality. No text.`,

    general: `
GENERAL PRODUCT RULES:
  STAGING WORLD: Create an environment that communicates the product's core benefit. Study the product name and category, then build a world that makes it feel desirable.
  Adapt the atmosphere to the product's personality.
  PRODUCT SCALE: product must fill 45-60% canvas — it must be the HERO.
  HEADLINE: 3-6 words, emotional or benefit-driven. Not generic.
  FEATURES (2-4): derive from product concept — quality, origin, key benefit
  BADGE: appropriate to the product
  FLUX PROMPT: [Product] in its ideal environment. [Appropriate lighting]. [Appropriate color palette]. [Product as hero]. Advertising quality. No text.`,
  };

  return (rules[category] ?? rules.general) + `\n  PREFERRED LAYOUT: ${layout}`;
}

// ─── System prompt ────────────────────────────────────────────────────────────

export function buildProductExhibitSystemPrompt(canvas: CanvasConfig): string {
  const W = canvas.width;
  const H = canvas.height;
  const PAD = Math.round(Math.min(W, H) * 0.05);

  return `You are the advertising art director behind campaigns for Apple, Nike, Chanel, Dyson, and LVMH.
You design product advertisement posters that make viewers feel: "I need this."

CANVAS: ${W}×${H}px | SAFE MARGINS: ${PAD}px all sides

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE FUNDAMENTAL LAW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE PRODUCT IS THE HERO. ALWAYS.

Visual hierarchy (by area, not font size):
  1. Product image       → 40-65% of canvas
  2. Product name / CTA  → 15-20%
  3. Feature callouts    → 10-15%
  4. Brand identity      → 5-10%

If headline > product:  WRONG.
If product < 25% area:  WRONG.
If product is small, floating, or secondary:  WRONG.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER NAMING CONVENTION (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use ONLY these semantic names. No emoji. No generic names.

  background/base          → solidBackground (full canvas, zIndex 0)
  background/texture       → noiseTexture (optional, opacity 0.03-0.06)
  background/gradient      → gradientLayer or colorOverlay (optional)
  product/hero             → backgroundImage (MAIN PRODUCT — with clipShape, LARGE)
  product/shadow           → geometricShape (shadow/ground below product)
  product/accent           → geometricShape (accent shape behind product)
  text/brand               → metaText (brand name — compact, understated)
  text/product-name        → titleText (product or campaign name — NOT enormous)
  text/tagline             → subtitleText (short emotional or benefit line)
  text/cta                 → userText (call-to-action)
  feature/headline         → bodyText or metaText (feature category)
  feature/01               → metaText (feature line 1)
  feature/02               → metaText (feature line 2)
  feature/03               → metaText (feature line 3)
  feature/04               → metaText (feature line 4)
  badge/offer              → geometricShape (circle, capsule, or rect — secondary focal point)
  badge/label              → metaText (badge text)
  trust/label-01           → metaText (trust signal 1)
  trust/label-02           → metaText (trust signal 2)
  brand/logo-placeholder   → logoPlaceholder
  brand/decorative-line    → accentLine

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYOUT VARIANTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A  Hero Product Close-Up    product fills 80% canvas height · compact text strip below
B  Premium Editorial        product right column · brand + copy left column
C  Commercial Launch        product center-left · feature list right · CTA badge
D  Full Bleed               product fills entire canvas · text overlays on dark zones
E  Feature Breakdown        product left column · feature callout system right
F  Beauty Centered          product fills center · minimal elegant text above and below

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUCT HERO RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Product MUST be the dominant visual element
• Minimum product area: 40% of canvas (width × height ≥ 0.40 × W × H)
• Use the EXACT coordinates from the layout zone — do NOT reduce product size
• ALWAYS include clipShape matching product dimensions exactly
• imageData.fit: "contain" for objects with clear silhouette (watch, bottle, shoe)
           "cover" for full-bleed or scene-based products (food, lifestyle)
• Include product/shadow below product (geometricShape, opacity 0.10-0.20)
• Product must have clear contrast from background — never lost in background

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TYPOGRAPHY RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• text/product-name: fontSize 28-60px (NOT 80-120px — headline is SECONDARY to product)
• text/tagline: fontSize 14-22px
• feature/0N: fontSize 11-16px
• trust/label: fontSize 10-14px
• text/brand: fontSize 10-14px, letter-spaced, understated
• Maximum 3 type sizes
• ALL text must stay within safe margins: x≥${PAD}, y≥${PAD}, x+w≤${W-PAD}, y+h≤${H-PAD}
• Text must NEVER fight the product for visual attention

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BRAND SYSTEM (REQUIRED EVERY POSTER)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every Product Exhibit poster MUST include:
  ✓ text/brand or text/product-name (brand name present)
  ✓ text/tagline (1 short emotional or benefit line)
  ✓ 2-4 feature/0N layers (product feature callouts)
  ✓ badge/offer (price, launch label, or CTA badge)
  ✓ trust/label-01 (at least 1 quality signal)

If any of these are missing: the poster is incomplete.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUCT STAGING RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The background must be a SPECIFIC WORLD for this product category.
Not a random backdrop. Not a generic grey gradient.
The environment must reinforce the product's core benefit.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMMERCIAL AD TEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before returning JSON, ask yourself:
  1. Can the viewer identify the product in 1 second?
  2. Can the viewer identify the product benefit in 3 seconds?
  3. Would a premium brand publish this?
If any answer is NO: rethink the composition.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLUX PROMPT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write a 90-130 word atmospheric scene specifically designed for this product category.
Include: product staging world + specific environmental props + lighting direction + color palette + texture.
Do NOT mention text, typography, logos, or layout.
The Flux image IS the product environment — it must make the product look desirable.

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
  const lang = setup.language ?? "en";

  // Resolve product content from structured fields or prompt
  const productName    = setup.productName     || setup.prompt || "Product";
  const brandName      = setup.brandName       || "";
  const productTagline = setup.productTagline  || "";
  const productFeatures = setup.productFeatures || "";
  const priceOffer     = setup.priceOffer      || "";
  const productCta     = setup.productCta      || "";
  const productWebsite = setup.productWebsite  || "";

  const briefSection = brief
    ? `\nDESIGN BRIEF:\n  Mood: ${brief.mood}\n  Composition: ${brief.composition}\n  Note: ${brief.designRationale ?? ""}`
    : "";

  const zones = getLayoutZones(layout, W, H, PAD);
  const creativeRules = getCategoryCreativeRules(category, layout);

  const featureLines = productFeatures
    ? productFeatures.split(/[,\n]/).map(s => s.trim()).filter(Boolean).slice(0, 5)
    : [];
  const featureSection = featureLines.length > 0
    ? `FEATURES:      ${featureLines.join(" / ")}`
    : `FEATURES:      (generate 2-4 compelling features for this ${category} product)`;

  return `Design a commercial product advertisement poster. THE PRODUCT IS THE HERO.

PRODUCT:  "${productName}"
${brandName ? `BRAND:    "${brandName}"` : "BRAND:    (generate brand name from product concept)"}
${productTagline ? `TAGLINE:  "${productTagline}"` : "TAGLINE:  (generate short emotional or benefit tagline)"}
${featureSection}
${priceOffer ? `PRICE:    "${priceOffer}"` : ""}
${productCta ? `CTA:      "${productCta}"` : ""}
${productWebsite ? `WEBSITE:  "${productWebsite}"` : ""}
CATEGORY: ${category} | LAYOUT: ${layout} | LANGUAGE: ${lang}
CANVAS: ${W}×${H}px | SAFE MARGINS: ${PAD}px
${briefSection}

${creativeRules}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYOUT ${layout} — EXACT ZONE COORDINATES
Use these values directly. Do not reduce product dimensions.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${zones}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENERATE THIS JSON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "plan": {
    "module": "Product Exhibit",
    "product_category": "${category}",
    "poster_intent": "sell | launch | promote | showcase | announce",
    "mood": "warm | premium | clean | playful | futuristic | elegant | bold",
    "layout_variant": "${layout}",
    "background_system": {
      "type": "solid | gradient | blurred_scene | tabletop | studio | texture",
      "color_palette": ["#hex1", "#hex2", "#hex3"],
      "description": "specific environment that communicates the product benefit"
    },
    "hero_product": {
      "placement": "${layout === "D" ? "full-bleed" : layout === "B" ? "right" : layout === "C" || layout === "E" ? "left" : "center"}",
      "scale": "use exact dimensions from zones above",
      "lighting": "soft | dramatic | glossy | natural | studio",
      "grounding": "shadow | reflection | surface | floating"
    },
    "typography": {
      "headline": "compelling product headline (3-6 words)",
      "headline_style": "bold-sans | serif | editorial | modern",
      "tagline": "short benefit or emotional line",
      "features": ["feature 1", "feature 2", "feature 3"],
      "alignment": "left | center"
    },
    "cta_or_offer": {
      "type": "price_badge | launch_badge | feature_badge | shop_cta",
      "text": "badge text",
      "placement": "upper-right | mid-right | lower-right | bottom"
    },
    "trust_signals": [{ "label": "quality signal", "icon_style": "pill | seal" }],
    "brand_signals": [{ "type": "logo_placeholder | decorative_line", "text": "brand" }],
    "visual_flow": "Z-flow | triangle-flow | centered-editorial | split-layout",
    "commercial_ad_test": {
      "product_visible_in_1s": true,
      "product_benefit_in_3s": true,
      "feels_like_real_ad": true
    },
    "safe_margin_rules": { "padding": "${PAD}px", "prevent_text_overflow": true, "prevent_product_corner_stack": true, "preserve_layer_names": true, "no_emoji_layer_names": true }
  },

  "layers": [
    LAYER 1 — background/base (REQUIRED, full canvas):
    { "id": "<uuid>", "type": "solidBackground", "label": "background/base",
      "x": 0, "y": 0, "width": ${W}, "height": ${H}, "zIndex": 0,
      "rotation": 0, "opacity": 1, "visible": true, "locked": false,
      "shapeData": { "shapeType": "rect", "fill": "<bg color from creative rules>", "stroke": "none", "strokeWidth": 0 } },

    LAYER 2 — product/hero (REQUIRED — use EXACT dimensions from zones, NOT smaller):
    { "id": "<uuid>", "type": "backgroundImage", "label": "product/hero",
      "x": <FROM ZONES — USE EXACT VALUE>, "y": <FROM ZONES — USE EXACT VALUE>,
      "width": <FROM ZONES — USE EXACT VALUE>, "height": <FROM ZONES — USE EXACT VALUE>,
      "zIndex": 3, "rotation": 0, "opacity": 1, "visible": true, "locked": false,
      "imageData": { "src": "", "fit": "contain" },
      "clipShape": { "type": "rect", "x": <same as layer x>, "y": <same as layer y>, "width": <same as layer w>, "height": <same as layer h> } },

    LAYER 3 — product/shadow (OPTIONAL — ellipse below product, very subtle):
    { "type": "geometricShape", "label": "product/shadow",
      "x": <below product center>, "y": <below product bottom>, "width": <product width * 0.6>, "height": <20-40>,
      "zIndex": 2, "opacity": 0.15,
      "shapeData": { "shapeType": "rect", "fill": "#000000", "stroke": "none", "strokeWidth": 0 } },

    LAYER 4 — text/brand (REQUIRED — small, understated):
    { "type": "metaText", "label": "text/brand",
      "x": <from zones>, "y": <from zones>, "width": <from zones>, "height": 18,
      "zIndex": 6, "opacity": 1,
      "textData": { "text": "${brandName || "BRAND NAME"}", "fontSize": 11-14,
        "fontFamily": "Space Mono or Inter", "fontWeight": "400",
        "fill": "<contrast color>", "align": "left",
        "letterSpacing": 4, "lineHeight": 1.4, "textTransform": "uppercase" } },

    LAYER 5 — text/product-name (REQUIRED — 28-60px MAX, not enormous):
    { "type": "titleText", "label": "text/product-name",
      "x": <from zones>, "y": <from zones>, "width": <from zones>, "height": <auto>,
      "zIndex": 6, "opacity": 1,
      "textData": { "text": "${productName}", "fontSize": 28-60,
        "fontFamily": "<category-appropriate font>", "fontWeight": "700",
        "fill": "<high contrast color>", "align": "left or center",
        "letterSpacing": -1, "lineHeight": 1.05, "textTransform": "none" } },

    LAYER 6 — text/tagline (REQUIRED):
    { "type": "subtitleText", "label": "text/tagline",
      "x": <from zones>, "y": <from zones>, "width": <from zones>, "height": 24,
      "zIndex": 6, "opacity": 1,
      "textData": { "text": "${productTagline || "(compelling tagline)"}", "fontSize": 14-20,
        "fontFamily": "Inter or Space Mono", "fontWeight": "300",
        "fill": "<contrast color>", "align": "left",
        "letterSpacing": 1, "lineHeight": 1.3 } },

    LAYERS 7-10 — feature/01 through feature/04 (REQUIRED — 2-4 features):
    { "type": "metaText", "label": "feature/01",
      "textData": { "text": "<feature 1>", "fontSize": 12-15, "fontWeight": "400",
        "letterSpacing": 1, "textTransform": "uppercase" } },
    { "type": "metaText", "label": "feature/02", ... },
    { "type": "metaText", "label": "feature/03", ... },

    LAYER — badge/offer (REQUIRED — geometricShape + badge/label text):
    { "type": "geometricShape", "label": "badge/offer", "zIndex": 7,
      "shapeData": { "shapeType": "rect" or "circle", "fill": "<accent color>" } },
    { "type": "metaText", "label": "badge/label",
      "textData": { "text": "${priceOffer || productCta || "New Arrival"}" } },

    LAYER — trust/label-01 (REQUIRED — at least 1 quality signal):
    { "type": "metaText", "label": "trust/label-01",
      "textData": { "text": "<quality signal>", "fontSize": 11-13 } },

    OPTIONAL — brand/logo-placeholder:
    { "type": "logoPlaceholder", "label": "brand/logo-placeholder" },

    OPTIONAL — background/texture (adds warmth):
    { "type": "noiseTexture", "label": "background/texture",
      "x": 0, "y": 0, "width": ${W}, "height": ${H}, "zIndex": 1, "opacity": 0.04 }
  ],

  "fonts": { "display": "<chosen display font>", "body": "<chosen body font>" },
  "palette": { "dominant": "#hex", "secondary": "#hex", "accent": "#hex", "background": "#hex" },
  "fluxPrompt": "<90-130 word category-specific product staging scene — see creative rules above>",
  "designRationale": "2 sentences: how product dominance was achieved and what world was created for it"
}

ABSOLUTE REQUIREMENTS:
1. background/base MUST be first layer (zIndex 0), MUST cover full canvas (x:0, y:0, w:${W}, h:${H})
2. product/hero MUST use the EXACT coordinate values from the zones above — do NOT reduce dimensions
3. product/hero width × height MUST be ≥ 40% of canvas area (${Math.round(W * H * 0.4)} px²)
4. text/product-name fontSize MUST be ≤ 60px — typography serves the product
5. text/brand, text/tagline, feature/01-02, badge/offer, trust/label-01 MUST all be present
6. ALL text layers MUST stay within safe margins (≥${PAD}px from all edges)
7. NO emoji in any layer label
8. Layer labels MUST follow the naming convention exactly
9. fluxPrompt MUST be 90-130 words, category-specific, no text/typography mentions`;
}

// ─── Exact layout zone coordinates ────────────────────────────────────────────
//
// CRITICAL DESIGN DECISION: These are EXACT values, not ranges.
// Ranges allow GPT to choose the minimum — exact values force the correct size.
// Product dimensions are calculated to guarantee ≥ 40% canvas coverage.

function getLayoutZones(layout: ProductLayout, W: number, H: number, PAD: number): string {
  const zones: Record<ProductLayout, string> = {

    // ── A: Hero Product Close-Up ──────────────────────────────────────────────
    // Product fills top 80% of canvas at full width. Compact text strip below.
    // Product area: W × 0.80H = 80% of canvas.
    A: `Layout A — Hero Product Close-Up (product fills 80% canvas height):

  product/hero:      x:0, y:0, width:${W}, height:${Math.round(H*0.80)}
  clipShape:         x:0, y:0, width:${W}, height:${Math.round(H*0.80)}
  imageData.fit:     "contain"

  text/brand:        x:${PAD}, y:${Math.round(H*0.82)}, width:${Math.round(W*0.45)}, height:18
  text/product-name: x:${PAD}, y:${Math.round(H*0.85)}, width:${Math.round(W*0.68)}, height:80, fontSize:36-54px
  text/tagline:      x:${PAD}, y:${Math.round(H*0.92)}, width:${Math.round(W*0.65)}, height:24
  feature/01:        x:${PAD}, y:${Math.round(H*0.95)}, width:${Math.round(W*0.44)}, height:16
  feature/02:        x:${Math.round(W*0.48)}, y:${Math.round(H*0.95)}, width:${Math.round(W*0.26)}, height:16
  badge/offer:       x:${Math.round(W*0.74)}, y:${Math.round(H*0.82)}, width:${Math.round(W*0.22)}, height:${Math.round(H*0.14)}
  badge/label:       centered inside badge/offer
  trust/label-01:    x:${Math.round(W*0.74)}, y:${Math.round(H*0.95)}, width:${Math.round(W*0.22)}, height:16
  brand/logo:        x:${Math.round(W*0.86)}, y:${Math.round(H*0.82)}, width:${Math.round(W*0.10)}, height:${Math.round(H*0.06)}`,

    // ── B: Premium Editorial ──────────────────────────────────────────────────
    // Product in right column (52% W, 88% H = 46% area). Brand + copy left.
    B: `Layout B — Premium Editorial (product right column, brand + copy left):

  product/hero:      x:${Math.round(W*0.46)}, y:${Math.round(H*0.04)}, width:${Math.round(W*0.52)}, height:${Math.round(H*0.88)}
  clipShape:         x:${Math.round(W*0.46)}, y:${Math.round(H*0.04)}, width:${Math.round(W*0.52)}, height:${Math.round(H*0.88)}
  imageData.fit:     "contain"

  text/brand:        x:${PAD}, y:${Math.round(H*0.06)}, width:${Math.round(W*0.40)}, height:18, letterSpacing:5, uppercase
  text/product-name: x:${PAD}, y:${Math.round(H*0.28)}, width:${Math.round(W*0.40)}, height:120, fontSize:44-64px
  text/tagline:      x:${PAD}, y:${Math.round(H*0.50)}, width:${Math.round(W*0.38)}, height:24
  feature/01:        x:${PAD}, y:${Math.round(H*0.58)}, width:${Math.round(W*0.38)}, height:16
  feature/02:        x:${PAD}, y:${Math.round(H*0.63)}, width:${Math.round(W*0.38)}, height:16
  feature/03:        x:${PAD}, y:${Math.round(H*0.68)}, width:${Math.round(W*0.38)}, height:16
  trust/label-01:    x:${PAD}, y:${Math.round(H*0.75)}, width:${Math.round(W*0.38)}, height:16
  trust/label-02:    x:${PAD}, y:${Math.round(H*0.79)}, width:${Math.round(W*0.38)}, height:16
  badge/offer:       x:${PAD}, y:${Math.round(H*0.86)}, width:${Math.round(W*0.36)}, height:${Math.round(H*0.08)}
  brand/logo:        x:${PAD}, y:${Math.round(H*0.94)}, width:${Math.round(W*0.14)}, height:${Math.round(H*0.04)}
  brand/decorative-line: x:${PAD}, y:${Math.round(H*0.24)}, width:${Math.round(W*0.32)}, height:2`,

    // ── C: Commercial Launch ──────────────────────────────────────────────────
    // Product center-left (57% W, 76% H = 43% area). Feature list right.
    C: `Layout C — Commercial Launch (product center-left, features right):

  product/hero:      x:${Math.round(W*0.02)}, y:${Math.round(H*0.14)}, width:${Math.round(W*0.57)}, height:${Math.round(H*0.78)}
  clipShape:         x:${Math.round(W*0.02)}, y:${Math.round(H*0.14)}, width:${Math.round(W*0.57)}, height:${Math.round(H*0.78)}
  imageData.fit:     "contain"

  text/brand:        x:${Math.round(W*0.62)}, y:${PAD}, width:${Math.round(W*0.35)}, height:18, letterSpacing:4
  text/product-name: x:${Math.round(W*0.62)}, y:${Math.round(H*0.08)}, width:${Math.round(W*0.35)}, height:120, fontSize:36-52px
  text/tagline:      x:${Math.round(W*0.62)}, y:${Math.round(H*0.22)}, width:${Math.round(W*0.34)}, height:24
  feature/01:        x:${Math.round(W*0.62)}, y:${Math.round(H*0.32)}, width:${Math.round(W*0.34)}, height:24
  feature/02:        x:${Math.round(W*0.62)}, y:${Math.round(H*0.40)}, width:${Math.round(W*0.34)}, height:24
  feature/03:        x:${Math.round(W*0.62)}, y:${Math.round(H*0.48)}, width:${Math.round(W*0.34)}, height:24
  feature/04:        x:${Math.round(W*0.62)}, y:${Math.round(H*0.56)}, width:${Math.round(W*0.34)}, height:24
  badge/offer:       x:${Math.round(W*0.62)}, y:${Math.round(H*0.68)}, width:${Math.round(W*0.34)}, height:${Math.round(H*0.10)}
  trust/label-01:    x:${Math.round(W*0.62)}, y:${Math.round(H*0.82)}, width:${Math.round(W*0.34)}, height:16
  trust/label-02:    x:${Math.round(W*0.62)}, y:${Math.round(H*0.86)}, width:${Math.round(W*0.34)}, height:16
  text/brand (bottom): x:${PAD}, y:${Math.round(H*0.94)}, width:${Math.round(W*0.55)}, height:16`,

    // ── D: Full Bleed ─────────────────────────────────────────────────────────
    // Product fills entire canvas (100% area). Text overlays on darkened zones.
    // Requires overlay layer for text readability.
    D: `Layout D — Full Bleed (product fills entire canvas, text overlays):

  product/hero:      x:0, y:0, width:${W}, height:${H}
  clipShape:         x:0, y:0, width:${W}, height:${H}
  imageData.fit:     "cover"

  REQUIRED: colorOverlay or geometricShape to darken top and/or bottom zones for text readability
  background/gradient: x:0, y:0, width:${W}, height:${Math.round(H*0.28)}, zIndex:2  ← darken top for headline
  background/gradient: x:0, y:${Math.round(H*0.72)}, width:${W}, height:${Math.round(H*0.28)}, zIndex:2  ← darken bottom for trust

  text/brand:        x:${PAD}, y:${Math.round(H*0.04)}, width:${Math.round(W*0.65)}, height:18
  text/product-name: x:${PAD}, y:${Math.round(H*0.08)}, width:${Math.round(W*0.68)}, height:130, fontSize:52-80px
  text/tagline:      x:${PAD}, y:${Math.round(H*0.22)}, width:${Math.round(W*0.65)}, height:24
  badge/offer:       x:${Math.round(W*0.68)}, y:${Math.round(H*0.06)}, width:${Math.round(W*0.28)}, height:${Math.round(H*0.16)}
  badge/label:       centered inside badge
  feature/01:        x:${PAD}, y:${Math.round(H*0.76)}, width:${Math.round(W*0.55)}, height:18
  feature/02:        x:${PAD}, y:${Math.round(H*0.80)}, width:${Math.round(W*0.55)}, height:18
  trust/label-01:    x:${PAD}, y:${Math.round(H*0.86)}, width:${Math.round(W*0.45)}, height:16
  trust/label-02:    x:${PAD}, y:${Math.round(H*0.90)}, width:${Math.round(W*0.45)}, height:16
  text/cta:          x:${PAD}, y:${Math.round(H*0.95)}, width:${Math.round(W*0.45)}, height:16`,

    // ── E: Feature Breakdown ──────────────────────────────────────────────────
    // Product left column (52% W, 80% H = 42% area). Feature callout system right.
    E: `Layout E — Feature Breakdown (product left, feature callout system right):

  product/hero:      x:${PAD}, y:${Math.round(H*0.12)}, width:${Math.round(W*0.52)}, height:${Math.round(H*0.80)}
  clipShape:         x:${PAD}, y:${Math.round(H*0.12)}, width:${Math.round(W*0.52)}, height:${Math.round(H*0.80)}
  imageData.fit:     "contain"

  text/brand:        x:${PAD}, y:${PAD}, width:${Math.round(W*0.50)}, height:18, uppercase, letterSpacing:5
  text/product-name: x:${Math.round(W*0.57)}, y:${PAD}, width:${Math.round(W*0.39)}, height:120, fontSize:32-52px
  text/tagline:      x:${Math.round(W*0.57)}, y:${Math.round(H*0.14)}, width:${Math.round(W*0.39)}, height:28
  feature/01:        x:${Math.round(W*0.57)}, y:${Math.round(H*0.22)}, width:${Math.round(W*0.39)}, height:36
  feature/02:        x:${Math.round(W*0.57)}, y:${Math.round(H*0.32)}, width:${Math.round(W*0.39)}, height:36
  feature/03:        x:${Math.round(W*0.57)}, y:${Math.round(H*0.42)}, width:${Math.round(W*0.39)}, height:36
  feature/04:        x:${Math.round(W*0.57)}, y:${Math.round(H*0.52)}, width:${Math.round(W*0.39)}, height:36
  feature/05 (opt):  x:${Math.round(W*0.57)}, y:${Math.round(H*0.62)}, width:${Math.round(W*0.39)}, height:36
  badge/offer:       x:${Math.round(W*0.57)}, y:${Math.round(H*0.74)}, width:${Math.round(W*0.38)}, height:${Math.round(H*0.10)}
  trust/label-01:    x:${Math.round(W*0.57)}, y:${Math.round(H*0.87)}, width:${Math.round(W*0.38)}, height:16
  trust/label-02:    x:${Math.round(W*0.57)}, y:${Math.round(H*0.91)}, width:${Math.round(W*0.38)}, height:16
  brand/logo:        x:${Math.round(W*0.57)}, y:${Math.round(H*0.95)}, width:${Math.round(W*0.16)}, height:${Math.round(H*0.03)}`,

    // ── F: Beauty Centered ────────────────────────────────────────────────────
    // Product fills center (88% W, 75% H = 66% area). Elegant text top and bottom.
    F: `Layout F — Beauty Centered (large centered product, elegant text strips):

  product/hero:      x:${Math.round(W*0.06)}, y:${Math.round(H*0.10)}, width:${Math.round(W*0.88)}, height:${Math.round(H*0.75)}
  clipShape:         x:${Math.round(W*0.06)}, y:${Math.round(H*0.10)}, width:${Math.round(W*0.88)}, height:${Math.round(H*0.75)}
  imageData.fit:     "contain"

  text/brand:        x:${PAD}, y:${Math.round(H*0.02)}, width:${W-PAD*2}, height:18, align:center, uppercase, letterSpacing:6
  text/product-name: x:${PAD}, y:${Math.round(H*0.05)}, width:${W-PAD*2}, height:60, fontSize:24-42px, align:center
  text/tagline:      x:${PAD}, y:${Math.round(H*0.87)}, width:${W-PAD*2}, height:24, align:center
  feature/01:        x:${PAD}, y:${Math.round(H*0.91)}, width:${Math.round(W*0.28)}, height:16  ← left
  feature/02:        x:${Math.round(W*0.36)}, y:${Math.round(H*0.91)}, width:${Math.round(W*0.28)}, height:16  ← center
  feature/03:        x:${Math.round(W*0.72)}, y:${Math.round(H*0.91)}, width:${Math.round(W*0.24)}, height:16  ← right
  badge/offer:       x:${Math.round(W*0.72)}, y:${Math.round(H*0.10)}, width:${Math.round(W*0.22)}, height:${Math.round(H*0.12)}  ← upper-right badge
  trust/label-01:    x:${PAD}, y:${Math.round(H*0.95)}, width:${Math.round(W*0.45)}, height:16
  trust/label-02:    x:${Math.round(W*0.55)}, y:${Math.round(H*0.95)}, width:${Math.round(W*0.40)}, height:16`,
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
    background_system: { type:"studio", color_palette:["#0a0a0a","#1a1a1a","#f5c400"], description:"Dark premium studio backdrop — product floats" },
    hero_product:      { placement:"center", scale:"60% canvas", lighting:"studio", grounding:"shadow" },
    typography:        { headline:concept || "PRODUCT", headline_style:"bold-sans", tagline:"Engineered to impress", features:["Premium Quality","Precision Built","Limited Edition"], alignment:"left" },
    cta_or_offer:      { type:"launch_badge", text:"New Arrival", placement:"upper-right" },
    trust_signals:     [{ label:"Premium Quality", icon_style:"pill" }, { label:"Handcrafted", icon_style:"seal" }],
    brand_signals:     [{ type:"decorative_line", text:"—" }],
    visual_flow:       "Z-flow",
    commercial_ad_test: { product_visible_in_1s: true, product_benefit_in_3s: true, feels_like_real_ad: true },
    safe_margin_rules: { padding:"5%", prevent_text_overflow:true, prevent_product_corner_stack:true, preserve_layer_names:true, no_emoji_layer_names:true },
  };
}

// ─── Export the plan type for use in layout route ─────────────────────────────

export type { ProductExhibitPlan as Plan };
