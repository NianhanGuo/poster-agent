/**
 * Atmospheric Event — event poster generation system.
 *
 * For concerts, festivals, exhibitions, workshops, lectures, conferences,
 * screenings, pop-ups, student shows, and immersive experiences.
 *
 * Design principle: Atmosphere → Event Name → Date & Location → Lineup → CTA
 * The viewer first feels the event mood, then finds the practical information.
 */

import type { PosterSetupConfig, CanvasConfig, DesignBrief } from "@/types/poster";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventType =
  | "festival" | "concert" | "exhibition" | "workshop" | "lecture"
  | "conference" | "screening" | "popup" | "student_show" | "performance"
  | "opening" | "party" | "general";

export type EventMood =
  | "cinematic" | "elegant" | "experimental" | "energetic"
  | "calm" | "futuristic" | "underground" | "academic" | "playful";

export type EventCompositionPreset =
  | "cinematic-festival"
  | "exhibition-editorial"
  | "academic-lecture"
  | "music-lineup"
  | "workshop-announcement"
  | "immersive-experience"
  | "minimal-gallery-opening";

export interface AtmosphericEventPlan {
  module: "Atmospheric Event";
  event_type: EventType;
  mood: EventMood;
  composition_preset: EventCompositionPreset;
  visual_strategy: "scene-led" | "typography-led" | "performer-led" | "venue-led" | "abstract-led";
  background_system: {
    type: "atmospheric_scene" | "gradient" | "abstract_light" | "stage_environment" | "gallery_space" | "solid";
    color_palette: string[];
    atmosphere: string;
  };
  typography: {
    title_style: "bold-condensed" | "elegant-serif" | "modern-sans" | "experimental-display";
    title_text: string;
    tagline: string;
    hierarchy: string[];
  };
  content_modules: {
    title: string;
    tagline: string;
    date_time: string;
    location: string;
    lineup_speakers: string[];
    description: string;
    cta: string;
    website: string;
    organizer: string;
    micro_labels: string[];
  };
  color_palette: {
    dark_base: string;
    glow_color: string;
    text_color: string;
    accent_color: string;
  };
  texture: "film-grain" | "paper-grain" | "soft-noise" | "clean-digital";
}

// ─── Event type detection ─────────────────────────────────────────────────────

const EVENT_TYPE_PATTERNS: [EventType, RegExp][] = [
  ["festival",     /\b(festival|fest|f[eê]te|fiesta|carnival|fair|outdoor|summer|winter|seasonal|music.festival)\b/i],
  ["concert",      /\b(concert|gig|show|live.music|tour|band|dj.set|recital|symphony|orchestra|performance.night)\b/i],
  ["exhibition",   /\b(exhibition|exhibit|gallery|art.show|museum|collection|installation|art.fair|showcase|display)\b/i],
  ["workshop",     /\b(workshop|class|training|bootcamp|masterclass|session|hands.?on|craft|tutorial|skill|learn)\b/i],
  ["lecture",      /\b(lecture|talk|speaker|keynote|presentation|seminar|forum|panel|discussion|symposium|address|ted)\b/i],
  ["conference",   /\b(conference|summit|congress|convention|meetup|networking|industry|professional|summit)\b/i],
  ["screening",    /\b(screening|film|cinema|movie|preview|premiere|viewing|documentary|short.film|projection)\b/i],
  ["popup",        /\b(pop.?up|market|bazaar|makers|artisan|vendor|flea|pop.up.shop|trunk.show)\b/i],
  ["student_show", /\b(student|graduate|thesis|degree|school|college|university|graduation|year.show|portfolio|grad.show)\b/i],
  ["performance",  /\b(theatre|theater|dance|ballet|opera|play|drama|cabaret|comedy|improv|circus|spoken.word)\b/i],
  ["opening",      /\b(opening|launch|debut|reveal|unveil|grand.opening|first.night|opening.night|vernissage)\b/i],
  ["party",        /\b(party|club|rave|night.?out|social|celebration|gala|anniversary|birthday|cocktail)\b/i],
];

export function detectEventType(text: string): EventType {
  const lower = (text || "").toLowerCase();
  for (const [type, pattern] of EVENT_TYPE_PATTERNS) {
    if (pattern.test(lower)) return type;
  }
  return "general";
}

// ─── Mood detection ───────────────────────────────────────────────────────────

const MOOD_PATTERNS: [EventMood, RegExp][] = [
  ["cinematic",    /\b(cinematic|epic|dramatic|atmospheric|immersive|large.?scale|spectacle|grand|blockbuster)\b/i],
  ["elegant",      /\b(elegant|refined|sophisticated|luxury|gala|formal|prestigious|classic|luxurious)\b/i],
  ["experimental", /\b(experimental|avant.?garde|underground|alternative|radical|unconventional|boundary)\b/i],
  ["energetic",    /\b(energetic|electric|intense|loud|bold|urgent|dynamic|explosive|vibrant|high.energy)\b/i],
  ["calm",         /\b(calm|quiet|serene|meditative|peaceful|gentle|slow|mindful|contemplative|still)\b/i],
  ["futuristic",   /\b(futuristic|tech|digital|future|innovation|virtual|cyber|neo|sci.?fi|AI|robotic)\b/i],
  ["underground",  /\b(underground|raw|gritty|DIY|punk|alternative|countercultural|subversive|lo.?fi)\b/i],
  ["academic",     /\b(academic|scholarly|institutional|professional|educational|research|formal|intellectual)\b/i],
  ["playful",      /\b(playful|fun|colorful|joyful|whimsical|lighthearted|community|family|kids|festive)\b/i],
];

export function detectEventMood(prompt: string, userMood?: string): EventMood {
  const valid: EventMood[] = ["cinematic","elegant","experimental","energetic","calm","futuristic","underground","academic","playful"];
  if (userMood && valid.includes(userMood as EventMood)) return userMood as EventMood;
  const lower = (prompt || "").toLowerCase();
  for (const [mood, pattern] of MOOD_PATTERNS) {
    if (pattern.test(lower)) return mood;
  }
  return "cinematic";
}

// ─── Composition preset selection ─────────────────────────────────────────────

const EVENT_TYPE_TO_PRESET: Record<EventType, EventCompositionPreset> = {
  festival:     "cinematic-festival",
  concert:      "music-lineup",
  exhibition:   "exhibition-editorial",
  workshop:     "workshop-announcement",
  lecture:      "academic-lecture",
  conference:   "academic-lecture",
  screening:    "cinematic-festival",
  popup:        "workshop-announcement",
  student_show: "exhibition-editorial",
  performance:  "cinematic-festival",
  opening:      "minimal-gallery-opening",
  party:        "music-lineup",
  general:      "cinematic-festival",
};

export function selectEventCompositionPreset(
  eventType: EventType,
  mood: EventMood,
): EventCompositionPreset {
  // Mood overrides for certain combinations
  if (mood === "experimental") return "immersive-experience";
  if (mood === "elegant" && (eventType === "opening" || eventType === "exhibition")) return "minimal-gallery-opening";
  if (mood === "academic") return "academic-lecture";
  return EVENT_TYPE_TO_PRESET[eventType] ?? "cinematic-festival";
}

// ─── Category-specific creative guidance ──────────────────────────────────────

function getEventCreativeRules(eventType: EventType, mood: EventMood, preset: EventCompositionPreset): string {
  const moodAtmosphere: Record<EventMood, string> = {
    cinematic:    "dark, atmospheric, cinematic — dramatic lighting, depth, mist or haze, emotional scale",
    elegant:      "sophisticated, refined — soft light, clean architecture, premium materials, restrained palette",
    experimental: "bold, unexpected — abstract light forms, geometric distortion, unconventional color",
    energetic:    "electric, high-contrast — bright accent colors, dynamic shapes, strong diagonals",
    calm:         "serene, meditative — soft gradients, negative space, gentle light, quiet tones",
    futuristic:   "technological, cold — neon accents, dark backgrounds, digital grid textures, chrome",
    underground:  "raw, gritty — high contrast B&W, grainy, industrial textures, minimal color",
    academic:     "clean, institutional — white or neutral background, structured layout, minimal decoration",
    playful:      "colorful, energetic — bright palette, round forms, warm tones, accessible",
  };

  const typeGuidance: Partial<Record<EventType, string>> = {
    festival:   "Background: sweeping landscape, stage lights, crowd silhouettes, atmospheric glow. Large title zone. Lineup list below title.",
    concert:    "Background: stage environment, dramatic lighting, performer silhouettes. Huge event name. Artist lineup hierarchy below.",
    exhibition: "Background: gallery space OR clean atmospheric gradient. Editorial typography. Artist/curator list. Opening dates prominent.",
    workshop:   "Background: studio or creative space, hands-on atmosphere. Clear text. Date and location must be prominent. Registration CTA.",
    lecture:    "Background: lecture hall, stage, academic atmosphere. Speaker name prominent. Date, time, venue clearly labeled. Registration link.",
    opening:    "Background: gallery interior, white walls, architectural. Elegant typography. Full address. RSVP link. Opening hours.",
    screening:  "Background: cinematic darkness, projection light, film atmosphere. Title large. Date, venue, runtime prominent.",
  };

  return `EVENT TYPE: ${eventType.toUpperCase()} | MOOD: ${mood.toUpperCase()} | PRESET: ${preset}

ATMOSPHERE:
  ${moodAtmosphere[mood]}

VISUAL GUIDANCE:
  ${typeGuidance[eventType] ?? "Create an atmospheric background that matches the event type and mood."}

FLUX PROMPT ATMOSPHERE GUIDANCE:
  Background image must: convey the event mood, have dark areas in the bottom 40% for text readability,
  avoid cluttered compositions that compete with typography, use cinematic depth and atmospheric quality.`;
}

// ─── System prompt ────────────────────────────────────────────────────────────

export function buildAtmosphericEventSystemPrompt(canvas: CanvasConfig): string {
  const W = canvas.width;
  const H = canvas.height;
  const PAD = Math.round(Math.min(W, H) * 0.05);

  return `You are a world-class event poster designer. You design for Lincoln Center, Tate Modern, Coachella, Sonar, Moogfest, Art Basel, and independent arts organizations.

CANVAS: ${W}×${H}px | SAFE MARGINS: ${PAD}px all sides
All visible text must stay within these margins.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVENT POSTER DESIGN PHILOSOPHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VIEWER EYE PATH: ATMOSPHERE → EVENT NAME → DATE & LOCATION → LINEUP/PROGRAM → CTA

1. ATMOSPHERE FIRST
   The background must promise the event experience before the viewer reads anything.
   The background is not decoration — it communicates the FEELING of attending.
   Dark, atmospheric scenes work best. The lower 40% needs dark value for text readability.

2. EVENT NAME IS DOMINANT
   The event name is the largest typographic element.
   Festivals/Concerts: 100-200px. Exhibitions/Openings: 72-120px. Lectures/Workshops: 60-90px.
   The name must be readable at distance.

3. INFORMATION HIERARCHY (always in this order):
   Level 1: Event name
   Level 2: Date and time (REQUIRED — never omit)
   Level 3: Location / venue (REQUIRED — never omit)
   Level 4: Lineup, speakers, artists, or program
   Level 5: Description or theme tagline
   Level 6: Ticket info / CTA / price
   Level 7: Website, organizer, micro-labels

4. TEXT DENSITY
   Event posters carry more text than product posters.
   Total text: 60-180 words is expected and correct.
   All information items have minimum readable sizes.
   Date and location: minimum 16px.
   Lineup names: minimum 13px.
   Micro labels: minimum 10px.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER NAMING CONVENTION (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use ONLY these semantic labels. No emoji. No generic names. No single letters.

  background/atmosphere    → solidBackground (full canvas, zIndex 0)
  background/scene         → backgroundImage WITH clipShape covering full canvas
  background/overlay       → colorOverlay (gradient to darken bottom for text readability)
  background/texture       → noiseTexture (opacity 0.04-0.09, full canvas)
  title/event-name         → titleText (largest element, event name)
  title/tagline            → subtitleText (short theme line)
  info/date                → bodyText (date and time — REQUIRED)
  info/location            → bodyText (venue and address — REQUIRED)
  info/lineup              → bodyText (artist/speaker list)
  info/description         → bodyText (event description)
  ticket/cta               → userText (call to action)
  ticket/price             → metaText (price or "Free Entry")
  ticket/website           → metaText (URL)
  organizer/name           → metaText (host or organizer)
  label/category           → metaText (event category chip)
  accent/line              → accentLine
  accent/shape             → geometricShape

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TYPOGRAPHY SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Title fonts by mood:
  cinematic/festival/concert: Bebas Neue, Oswald, Barlow Condensed (bold condensed)
  elegant/opening/gallery:    Playfair Display, Cormorant Garamond, EB Garamond (editorial serif)
  experimental/underground:   Syne, Space Grotesk, DM Mono (contemporary sans/mono)
  academic/lecture:           Georgia, Libre Baskerville, Inter (readable, authoritative)
  energetic/party:            Bebas Neue, Impact, Barlow Condensed (impact)

Info/body fonts: Space Mono, Inter, DM Sans, IBM Plex Mono — always readable, never decorative.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLUX PROMPT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write an 80-120 word atmospheric scene. No text, typography, or poster layout.
The image must have dark values in the bottom 40% for text overlay readability.
Match exactly to the event type and mood.
Cinematic quality: depth, atmospheric light, texture, emotional impact.

Return ONLY valid JSON. No markdown. No code fences.`;
}

// ─── User prompt ──────────────────────────────────────────────────────────────

export function buildAtmosphericEventUserPrompt(
  setup: PosterSetupConfig,
  canvas: CanvasConfig,
  brief: DesignBrief | undefined,
  eventType: EventType,
  mood: EventMood,
  compositionPreset: EventCompositionPreset,
): string {
  const W = canvas.width;
  const H = canvas.height;
  const PAD = Math.round(Math.min(W, H) * 0.05);
  const lang = setup.language ?? "en";

  // Resolve event content — structured fields take priority over prompt
  const eventName    = setup.eventName      || setup.prompt || "THE EVENT";
  const eventTypeTxt = setup.eventType      || eventType;
  const date         = setup.eventDate      || "";
  const time         = setup.eventTime      || "";
  const location     = setup.eventLocation  || "";
  const description  = setup.eventDescription || "";
  const lineup       = setup.eventLineup    || "";
  const ticketInfo   = setup.ticketInfo     || "";
  const cta          = setup.eventCta       || "Get Tickets";
  const organizer    = setup.eventOrganizer || "";
  const website      = setup.eventWebsite   || "";

  const dateTime = [date, time].filter(Boolean).join(" · ");

  const briefSection = brief
    ? `\nDESIGN BRIEF:\n  Mood: ${brief.mood}\n  Composition: ${brief.composition}\n  Note: ${brief.designRationale ?? ""}`
    : "";

  const zones = getEventLayoutZones(compositionPreset, W, H, PAD);
  const rules = getEventCreativeRules(eventType, mood, compositionPreset);

  // Build lineup layer snippet only when lineup data exists
  const lineupLayer = lineup
    ? `    { "type": "bodyText", "label": "info/lineup",
      "x": <from zones>, "y": <from zones>, "width": <from zones>,
      "zIndex": 7, "rotation": 0, "opacity": 1, "visible": true, "locked": false,
      "textData": { "text": "${lineup.replace(/"/g, "'")}", "fontSize": 14-20,
        "fontFamily": "Space Mono or Inter", "fontWeight": "400", "fontStyle": "normal",
        "fill": "#ffffff or high-contrast color", "align": "left",
        "letterSpacing": 1, "lineHeight": 1.4, "textTransform": "none" } },`
    : "    // info/lineup — omit if no lineup provided";

  const descLayer = description
    ? `    { "type": "bodyText", "label": "info/description",
      "x": <from zones>, "y": <from zones>, "width": <from zones>,
      "zIndex": 6, "rotation": 0, "opacity": 1, "visible": true, "locked": false,
      "textData": { "text": "${description.replace(/"/g, "'").slice(0,120)}", "fontSize": 13-16,
        "fontFamily": "Inter or Space Mono", "fontWeight": "300", "fontStyle": "normal",
        "fill": "rgba(255,255,255,0.75) or body text color", "align": "left",
        "letterSpacing": 0, "lineHeight": 1.5, "textTransform": "none" } },`
    : "    // info/description — omit if no description provided";

  const websiteLayer = website
    ? `    { "type": "metaText", "label": "ticket/website",
      "x": <from zones>, "y": <from zones>, "width": <from zones>,
      "zIndex": 7, "rotation": 0, "opacity": 1, "visible": true, "locked": false,
      "textData": { "text": "${website}", "fontSize": 11-14,
        "fontFamily": "Space Mono", "fontWeight": "400", "fontStyle": "normal",
        "fill": "rgba(255,255,255,0.65)", "align": "left",
        "letterSpacing": 2, "lineHeight": 1.4, "textTransform": "none" } },`
    : "    // ticket/website — omit if no website provided";

  const organizerLayer = organizer
    ? `    { "type": "metaText", "label": "organizer/name",
      "x": <from zones>, "y": <from zones>, "width": <from zones>,
      "zIndex": 6, "rotation": 0, "opacity": 1, "visible": true, "locked": false,
      "textData": { "text": "${organizer}", "fontSize": 11-13,
        "fontFamily": "Space Mono", "fontWeight": "400", "fontStyle": "normal",
        "fill": "rgba(255,255,255,0.55)", "align": "left",
        "letterSpacing": 2, "lineHeight": 1.4, "textTransform": "uppercase" } },`
    : "    // organizer/name — omit if no organizer provided";

  return `Design a professional event poster.

EVENT: "${eventName}"
TYPE: ${eventTypeTxt} | MOOD: ${mood} | COMPOSITION: ${compositionPreset}
LANGUAGE: ${lang}
CANVAS: ${W}×${H}px | SAFE MARGINS: ${PAD}px all sides
${briefSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVENT CONTENT (include ALL provided information)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TITLE:        ${eventName}
${description ? `TAGLINE:      (generate from: "${description.split(/[.!?]/)[0]}")` : "TAGLINE:      (generate a compelling short tagline for this event type)"}
DATE & TIME:  ${dateTime || "(no date provided — write placeholder: Date & Time)"}
LOCATION:     ${location || "(no location provided — write placeholder: Venue, City)"}
${lineup ? `LINEUP:       ${lineup}` : ""}
${description ? `DESCRIPTION:  ${description}` : ""}
CTA:          ${cta}
${ticketInfo ? `TICKETS:      ${ticketInfo}` : ""}
${website ? `WEBSITE:      ${website}` : ""}
${organizer ? `ORGANIZER:    ${organizer}` : ""}

${rules}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYOUT ZONES (follow these coordinate ranges exactly)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${zones}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENERATE THIS EXACT JSON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "plan": {
    "module": "Atmospheric Event",
    "event_type": "${eventType}",
    "mood": "${mood}",
    "composition_preset": "${compositionPreset}",
    "visual_strategy": "scene-led | typography-led | abstract-led",
    "background_system": {
      "type": "atmospheric_scene | gradient | abstract_light | stage_environment",
      "color_palette": ["#dark_base", "#glow_accent", "#highlight"],
      "atmosphere": "one-sentence description of the background atmosphere"
    },
    "typography": {
      "title_style": "bold-condensed | elegant-serif | modern-sans | experimental-display",
      "title_text": "${eventName}",
      "tagline": "compelling short tagline for ${eventTypeTxt}",
      "hierarchy": ["title/event-name", "info/date", "info/location", "info/lineup", "ticket/cta"]
    },
    "content_modules": {
      "title": "${eventName}",
      "tagline": "...",
      "date_time": "${dateTime || "Date TBD"}",
      "location": "${location || "Venue TBD"}",
      "lineup_speakers": [${lineup ? `"${lineup.split(',').map(s => s.trim()).join('","')}"` : ""}],
      "description": "${description.replace(/"/g,"'")}",
      "cta": "${cta}",
      "website": "${website}",
      "organizer": "${organizer}",
      "micro_labels": ["${eventTypeTxt.toUpperCase()}", "2025", "edition-01"]
    },
    "color_palette": {
      "dark_base": "#hex (background base)",
      "glow_color": "#hex (atmospheric accent)",
      "text_color": "#ffffff (primary text on dark bg)",
      "accent_color": "#hex (CTA, labels, accent)"
    },
    "texture": "film-grain | paper-grain | soft-noise | clean-digital"
  },

  "layers": [
    { "id": "<uuid>", "type": "solidBackground", "label": "background/atmosphere",
      "x": 0, "y": 0, "width": ${W}, "height": ${H},
      "zIndex": 0, "rotation": 0, "opacity": 1, "visible": true, "locked": false,
      "shapeData": { "shapeType": "rect", "fill": "<dark atmospheric base color>", "stroke": "none", "strokeWidth": 0 } },

    { "id": "<uuid>", "type": "backgroundImage", "label": "background/scene",
      "x": 0, "y": 0, "width": ${W}, "height": ${H},
      "zIndex": 1, "rotation": 0, "opacity": 0.85, "visible": true, "locked": false,
      "imageData": { "src": "", "fit": "cover" },
      "clipShape": { "type": "rect", "x": 0, "y": 0, "width": ${W}, "height": ${H} } },

    { "id": "<uuid>", "type": "colorOverlay", "label": "background/overlay",
      "x": 0, "y": ${Math.round(H * 0.40)}, "width": ${W}, "height": ${Math.round(H * 0.60)},
      "zIndex": 2, "rotation": 0, "opacity": 1, "visible": true, "locked": false,
      "overlayData": { "gradientType": "linear", "colors": ["transparent", "#000000"], "direction": 180, "opacity": 0.65 } },

    { "id": "<uuid>", "type": "noiseTexture", "label": "background/texture",
      "x": 0, "y": 0, "width": ${W}, "height": ${H},
      "zIndex": 3, "rotation": 0, "opacity": 0.06, "visible": true, "locked": false },

    { "id": "<uuid>", "type": "titleText", "label": "title/event-name",
      "x": <from zones>, "y": <from zones>, "width": <from zones>, "height": <from zones>,
      "zIndex": 8, "rotation": 0, "opacity": 1, "visible": true, "locked": false,
      "textData": { "text": "${eventName}", "fontSize": <see zones for your preset>,
        "fontFamily": "<mood-appropriate display font>", "fontWeight": "700", "fontStyle": "normal",
        "fill": "#ffffff", "align": "left or center per preset",
        "letterSpacing": -2, "lineHeight": 0.88, "textTransform": "uppercase" } },

    { "id": "<uuid>", "type": "subtitleText", "label": "title/tagline",
      "x": <from zones>, "y": <from zones>, "width": <from zones>, "height": 40,
      "zIndex": 7, "rotation": 0, "opacity": 1, "visible": true, "locked": false,
      "textData": { "text": "<compelling tagline>", "fontSize": 16-24,
        "fontFamily": "Inter or Space Mono", "fontWeight": "300", "fontStyle": "normal",
        "fill": "rgba(255,255,255,0.80)", "align": "left",
        "letterSpacing": 2, "lineHeight": 1.3, "textTransform": "none" } },

    { "id": "<uuid>", "type": "bodyText", "label": "info/date",
      "x": <from zones>, "y": <from zones>, "width": <from zones>, "height": 32,
      "zIndex": 7, "rotation": 0, "opacity": 1, "visible": true, "locked": false,
      "textData": { "text": "${dateTime || "DATE · TIME"}", "fontSize": 18-24,
        "fontFamily": "Space Mono", "fontWeight": "400", "fontStyle": "normal",
        "fill": "#ffffff", "align": "left",
        "letterSpacing": 3, "lineHeight": 1.2, "textTransform": "uppercase" } },

    { "id": "<uuid>", "type": "bodyText", "label": "info/location",
      "x": <from zones>, "y": <from zones>, "width": <from zones>, "height": 28,
      "zIndex": 7, "rotation": 0, "opacity": 1, "visible": true, "locked": false,
      "textData": { "text": "${location || "VENUE · CITY"}", "fontSize": 16-20,
        "fontFamily": "Space Mono", "fontWeight": "400", "fontStyle": "normal",
        "fill": "rgba(255,255,255,0.85)", "align": "left",
        "letterSpacing": 2, "lineHeight": 1.2, "textTransform": "none" } },

${lineupLayer}

${descLayer}

    { "id": "<uuid>", "type": "userText", "label": "ticket/cta",
      "x": <from zones>, "y": <from zones>, "width": <from zones>, "height": 28,
      "zIndex": 9, "rotation": 0, "opacity": 1, "visible": true, "locked": false,
      "textData": { "text": "${cta}", "fontSize": 14-18,
        "fontFamily": "Space Mono or Inter", "fontWeight": "700", "fontStyle": "normal",
        "fill": "#ffffff or accent color", "align": "left",
        "letterSpacing": 3, "lineHeight": 1.2, "textTransform": "uppercase" } },

${websiteLayer}

${organizerLayer}

    { "id": "<uuid>", "type": "metaText", "label": "label/category",
      "x": ${PAD}, "y": ${PAD}, "width": ${Math.round(W * 0.55)}, "height": 20,
      "zIndex": 6, "rotation": 0, "opacity": 1, "visible": true, "locked": false,
      "textData": { "text": "${eventTypeTxt.toUpperCase().replace('_',' ')}", "fontSize": 11,
        "fontFamily": "Space Mono", "fontWeight": "400", "fontStyle": "normal",
        "fill": "rgba(255,255,255,0.55)", "align": "left",
        "letterSpacing": 5, "lineHeight": 1.4, "textTransform": "uppercase" } }
  ],

  "fonts": { "display": "<chosen display font>", "body": "Space Mono or Inter" },
  "palette": { "dominant": "#hex", "secondary": "#hex", "accent": "#hex", "background": "#hex" },
  "fluxPrompt": "<80-120 word atmospheric scene for this ${eventTypeTxt} event with ${mood} mood. No text or typography. Dark values in bottom 40% for text readability. Cinematic quality.>",
  "designRationale": "2 sentences: key visual decision and why it serves the ${eventTypeTxt} event"
}

ABSOLUTE REQUIREMENTS:
1. background/atmosphere (solidBackground) MUST be first layer, full canvas, zIndex 0
2. background/scene (backgroundImage) MUST have clipShape covering full canvas
3. background/overlay (colorOverlay) MUST darken the bottom zone for text readability
4. title/event-name MUST be the largest text element — follow zone sizes for your preset
5. info/date MUST be present and minimum 18px
6. info/location MUST be present and minimum 16px
7. ALL text stays within ${PAD}px safe margins on all sides
8. NO emoji in any layer label
9. Layer labels follow semantic naming exactly (background/..., title/..., info/..., ticket/..., label/...)
10. fluxPrompt is 80-120 words, matches the ${eventTypeTxt}/${mood} atmosphere, no typography`;
}

// ─── Layout zones per composition preset ─────────────────────────────────────

function getEventLayoutZones(
  preset: EventCompositionPreset,
  W: number,
  H: number,
  PAD: number,
): string {
  const zones: Record<EventCompositionPreset, string> = {

    "cinematic-festival": `CINEMATIC FESTIVAL:
  label/category:     x:${PAD}, y:${PAD}, width:${Math.round(W*0.55)}, fontSize:11px
  info/date (top):    x:${Math.round(W*0.60)}, y:${PAD}, width:${Math.round(W*0.36)}, fontSize:13px  (small dates at top-right)
  title/event-name:   x:${PAD}, y:${Math.round(H*0.30)}-${Math.round(H*0.42)}, width:${Math.round(W*0.90)}, height:${Math.round(H*0.28)}, fontSize:120-200px
  title/tagline:      x:${PAD}, y:${Math.round(H*0.18)}-${Math.round(H*0.24)}, width:${Math.round(W*0.70)}, fontSize:16-22px
  info/lineup:        x:${PAD}, y:${Math.round(H*0.65)}-${Math.round(H*0.76)}, width:${Math.round(W*0.85)}, fontSize:14-18px
  info/date (body):   x:${PAD}, y:${Math.round(H*0.77)}-${Math.round(H*0.82)}, width:${Math.round(W*0.55)}, fontSize:18-24px
  info/location:      x:${PAD}, y:${Math.round(H*0.82)}-${Math.round(H*0.87)}, width:${Math.round(W*0.70)}, fontSize:15-18px
  ticket/cta:         x:${Math.round(W*0.60)}, y:${Math.round(H*0.78)}-${Math.round(H*0.86)}, width:${Math.round(W*0.35)}, fontSize:14px
  ticket/website:     x:${PAD}, y:${Math.round(H*0.90)}-${Math.round(H*0.95)}, fontSize:11px
  organizer/name:     x:${Math.round(W*0.60)}, y:${Math.round(H*0.90)}-${Math.round(H*0.95)}, fontSize:11px`,

    "exhibition-editorial": `EXHIBITION EDITORIAL:
  title/event-name:   x:${PAD}, y:${Math.round(H*0.07)}-${Math.round(H*0.18)}, width:${Math.round(W*0.85)}, height:${Math.round(H*0.20)}, fontSize:80-120px
  title/tagline:      x:${PAD}, y:${Math.round(H*0.28)}-${Math.round(H*0.34)}, width:${Math.round(W*0.70)}, fontSize:18-24px
  info/lineup:        x:${PAD}, y:${Math.round(H*0.38)}-${Math.round(H*0.58)}, width:${Math.round(W*0.55)}, fontSize:14-20px  (artist/curator list)
  info/description:   x:${Math.round(W*0.58)}, y:${Math.round(H*0.40)}-${Math.round(H*0.60)}, width:${Math.round(W*0.38)}, fontSize:12-14px
  info/date:          x:${PAD}, y:${Math.round(H*0.64)}-${Math.round(H*0.70)}, fontSize:18-22px
  info/location:      x:${PAD}, y:${Math.round(H*0.70)}-${Math.round(H*0.76)}, fontSize:15-18px
  ticket/cta:         x:${PAD}, y:${Math.round(H*0.80)}-${Math.round(H*0.86)}, fontSize:13-16px
  ticket/website:     x:${PAD}, y:${Math.round(H*0.88)}-${Math.round(H*0.93)}, fontSize:11px
  organizer/name:     x:${Math.round(W*0.55)}, y:${Math.round(H*0.88)}-${Math.round(H*0.93)}, fontSize:11px
  label/category:     x:${PAD}, y:${PAD}, fontSize:11px`,

    "academic-lecture": `ACADEMIC LECTURE:
  label/category:     x:${PAD}, y:${PAD}, width:${Math.round(W*0.55)}, fontSize:11px  (institution / event series)
  title/event-name:   x:${PAD}, y:${Math.round(H*0.22)}-${Math.round(H*0.32)}, width:${Math.round(W*0.85)}, height:${Math.round(H*0.22)}, fontSize:60-90px
  title/tagline:      x:${PAD}, y:${Math.round(H*0.44)}-${Math.round(H*0.50)}, width:${Math.round(W*0.75)}, fontSize:17-22px
  info/lineup:        x:${PAD}, y:${Math.round(H*0.52)}-${Math.round(H*0.60)}, width:${Math.round(W*0.70)}, fontSize:15-18px  (speaker name + role)
  info/date:          x:${PAD}, y:${Math.round(H*0.65)}-${Math.round(H*0.71)}, fontSize:18-22px
  info/location:      x:${PAD}, y:${Math.round(H*0.71)}-${Math.round(H*0.77)}, fontSize:15-18px
  ticket/cta:         x:${PAD}, y:${Math.round(H*0.81)}-${Math.round(H*0.87)}, fontSize:14px
  ticket/price:       x:${Math.round(W*0.55)}, y:${Math.round(H*0.81)}-${Math.round(H*0.87)}, fontSize:13px
  ticket/website:     x:${PAD}, y:${Math.round(H*0.89)}-${Math.round(H*0.94)}, fontSize:11px
  organizer/name:     x:${Math.round(W*0.55)}, y:${Math.round(H*0.89)}-${Math.round(H*0.94)}, fontSize:11px`,

    "music-lineup": `MUSIC LINEUP:
  label/category:     x:${PAD}, y:${PAD}, fontSize:11px
  info/date (top):    x:${Math.round(W*0.65)}, y:${PAD}, width:${Math.round(W*0.30)}, fontSize:12px
  title/event-name:   x:${PAD}, y:${Math.round(H*0.07)}-${Math.round(H*0.20)}, width:${Math.round(W*0.92)}, height:${Math.round(H*0.30)}, fontSize:130-200px  ← MASSIVE
  title/tagline:      x:${PAD}, y:${Math.round(H*0.38)}-${Math.round(H*0.44)}, width:${Math.round(W*0.75)}, fontSize:16-20px
  info/lineup:        x:${PAD}, y:${Math.round(H*0.47)}-${Math.round(H*0.68)}, width:${Math.round(W*0.85)}, fontSize:13-20px  (headliner biggest, support smaller)
  info/date (body):   x:${PAD}, y:${Math.round(H*0.71)}-${Math.round(H*0.77)}, fontSize:18-22px
  info/location:      x:${PAD}, y:${Math.round(H*0.77)}-${Math.round(H*0.82)}, fontSize:15-18px
  ticket/cta:         x:${PAD}, y:${Math.round(H*0.85)}-${Math.round(H*0.91)}, fontSize:14-16px  (bold, prominent)
  ticket/website:     x:${Math.round(W*0.55)}, y:${Math.round(H*0.85)}-${Math.round(H*0.91)}, fontSize:11px
  organizer/name:     x:${PAD}, y:${Math.round(H*0.93)}-${Math.round(H*0.97)}, fontSize:10px`,

    "workshop-announcement": `WORKSHOP ANNOUNCEMENT:
  label/category:     x:${PAD}, y:${PAD}, width:${Math.round(W*0.55)}, fontSize:11px  (WORKSHOP / MASTERCLASS)
  title/event-name:   x:${PAD}, y:${Math.round(H*0.10)}-${Math.round(H*0.20)}, width:${Math.round(W*0.88)}, height:${Math.round(H*0.22)}, fontSize:60-90px
  title/tagline:      x:${PAD}, y:${Math.round(H*0.32)}-${Math.round(H*0.38)}, width:${Math.round(W*0.80)}, fontSize:16-20px
  info/date:          x:${PAD}, y:${Math.round(H*0.44)}-${Math.round(H*0.51)}, fontSize:20-24px  ← PROMINENT
  info/location:      x:${PAD}, y:${Math.round(H*0.51)}-${Math.round(H*0.57)}, fontSize:17-20px
  info/description:   x:${PAD}, y:${Math.round(H*0.61)}-${Math.round(H*0.74)}, width:${Math.round(W*0.82)}, fontSize:13-15px
  info/lineup:        x:${PAD}, y:${Math.round(H*0.76)}-${Math.round(H*0.82)}, fontSize:14-16px  (facilitator name)
  ticket/cta:         x:${PAD}, y:${Math.round(H*0.85)}-${Math.round(H*0.91)}, fontSize:14px  (Register Now / Limited Spots)
  ticket/price:       x:${Math.round(W*0.55)}, y:${Math.round(H*0.85)}-${Math.round(H*0.91)}, fontSize:14px
  ticket/website:     x:${PAD}, y:${Math.round(H*0.93)}-${Math.round(H*0.97)}, fontSize:11px`,

    "immersive-experience": `IMMERSIVE EXPERIENCE:
  label/category:     x:${PAD}, y:${Math.round(H*0.07)}, fontSize:11px  (floating label)
  title/event-name:   x:${PAD}, y:${Math.round(H*0.32)}-${Math.round(H*0.48)}, width:${Math.round(W*0.88)}, height:${Math.round(H*0.28)}, fontSize:100-160px  ← dramatic, centered vertically
  title/tagline:      x:${PAD}, y:${Math.round(H*0.58)}-${Math.round(H*0.64)}, width:${Math.round(W*0.72)}, fontSize:16-20px
  info/date:          x:${PAD}, y:${Math.round(H*0.70)}-${Math.round(H*0.76)}, fontSize:16-20px
  info/location:      x:${PAD}, y:${Math.round(H*0.76)}-${Math.round(H*0.82)}, fontSize:15-18px
  info/lineup:        x:${Math.round(W*0.55)}, y:${Math.round(H*0.70)}-${Math.round(H*0.84)}, width:${Math.round(W*0.40)}, fontSize:12-14px
  ticket/cta:         x:${PAD}, y:${Math.round(H*0.86)}-${Math.round(H*0.92)}, fontSize:13-16px
  ticket/website:     x:${PAD}, y:${Math.round(H*0.93)}-${Math.round(H*0.97)}, fontSize:11px`,

    "minimal-gallery-opening": `MINIMAL GALLERY OPENING:
  title/event-name:   x:${PAD}, y:${Math.round(H*0.06)}-${Math.round(H*0.16)}, width:${Math.round(W*0.82)}, height:${Math.round(H*0.18)}, fontSize:72-100px  (elegant, not enormous)
  title/tagline:      x:${PAD}, y:${Math.round(H*0.22)}-${Math.round(H*0.27)}, width:${Math.round(W*0.70)}, fontSize:16-20px  (artist name or subtitle)
  info/lineup:        x:${PAD}, y:${Math.round(H*0.30)}-${Math.round(H*0.52)}, width:${Math.round(W*0.55)}, fontSize:13-16px  (artwork list / artist statement)
  info/description:   x:${Math.round(W*0.58)}, y:${Math.round(H*0.30)}-${Math.round(H*0.52)}, width:${Math.round(W*0.38)}, fontSize:12-13px
  info/date:          x:${PAD}, y:${Math.round(H*0.58)}-${Math.round(H*0.63)}, fontSize:17-20px  (Opening: Date, Time)
  info/location:      x:${PAD}, y:${Math.round(H*0.63)}-${Math.round(H*0.70)}, fontSize:14-17px  (full gallery address)
  ticket/cta:         x:${PAD}, y:${Math.round(H*0.75)}-${Math.round(H*0.80)}, fontSize:13-15px  (RSVP / Free Entry)
  ticket/website:     x:${PAD}, y:${Math.round(H*0.82)}-${Math.round(H*0.87)}, fontSize:11-13px
  organizer/name:     x:${PAD}, y:${Math.round(H*0.89)}-${Math.round(H*0.94)}, fontSize:11px
  label/category:     x:${PAD}, y:${PAD}, fontSize:11px  (EXHIBITION / OPENING NIGHT)`,
  };

  return zones[preset] ?? zones["cinematic-festival"];
}
