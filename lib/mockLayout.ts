// Generates a plausible poster layout without calling any AI API.
// Used when ANTHROPIC_API_KEY is not configured (demo / Vercel zero-config).

import { v4 as uuidv4 } from "uuid";
import type {
  Layer,
  CanvasConfig,
  PosterSetupConfig,
  StylePreset,
} from "@/types/poster";

// Per-style typography + color defaults
interface StyleDef {
  titleFont: string;
  subtitleFont: string;
  bodyFont: string;
  titleColor: string;
  subtitleColor: string;
  bodyColor: string;
  titleStyle: string;
  titleAlign: "left" | "center" | "right";
  titleLetterSpacing: number;
}

const STYLES: Record<StylePreset, StyleDef> = {
  cinematic: {
    titleFont: "Impact",
    subtitleFont: "Helvetica",
    bodyFont: "Helvetica",
    titleColor: "#ffffff",
    subtitleColor: "#cccccc",
    bodyColor: "#999999",
    titleStyle: "normal",
    titleAlign: "center",
    titleLetterSpacing: 10,
  },
  "gallery-minimal": {
    titleFont: "Georgia",
    subtitleFont: "Georgia",
    bodyFont: "Arial",
    titleColor: "#1a1a1a",
    subtitleColor: "#444444",
    bodyColor: "#777777",
    titleStyle: "normal",
    titleAlign: "left",
    titleLetterSpacing: 2,
  },
  brutalist: {
    titleFont: "Impact",
    subtitleFont: "Arial",
    bodyFont: "Courier New",
    titleColor: "#000000",
    subtitleColor: "#ffffff",
    bodyColor: "#555555",
    titleStyle: "bold",
    titleAlign: "left",
    titleLetterSpacing: -2,
  },
  editorial: {
    titleFont: "Georgia",
    subtitleFont: "Arial",
    bodyFont: "Georgia",
    titleColor: "#1a1a1a",
    subtitleColor: "#333333",
    bodyColor: "#666666",
    titleStyle: "italic",
    titleAlign: "left",
    titleLetterSpacing: 1,
  },
  surreal: {
    titleFont: "Palatino",
    subtitleFont: "Palatino",
    bodyFont: "Arial",
    titleColor: "#e8d5ff",
    subtitleColor: "#c4a8ff",
    bodyColor: "#9977cc",
    titleStyle: "italic",
    titleAlign: "center",
    titleLetterSpacing: 5,
  },
  experimental: {
    titleFont: "Courier New",
    subtitleFont: "Arial",
    bodyFont: "Courier New",
    titleColor: "#00ffcc",
    subtitleColor: "#ffffff",
    bodyColor: "#aaaaaa",
    titleStyle: "bold",
    titleAlign: "right",
    titleLetterSpacing: -1,
  },
};

// Default text for when the user didn't provide any and AI copy is off
const FILM_DEFAULTS = {
  title: "UNTITLED FILM",
  subtitle: "A story of light and shadow",
  dateLocation: "Coming soon",
  credits: "Written & Directed by —",
};

const EXHIBITION_DEFAULTS = {
  title: "EXHIBITION",
  subtitle: "Works on Paper and Space",
  dateLocation: "1 Jan – 28 Feb 2026",
  credits: "Gallery — City",
};

function px(canvas: CanvasConfig, ratioX: number, ratioY: number) {
  return { x: Math.round(canvas.width * ratioX), y: Math.round(canvas.height * ratioY) };
}

export function mockLayout(
  setup: PosterSetupConfig,
  canvas: CanvasConfig
): { layers: Layer[]; imagePrompt: string; designNotes: string } {
  const st = STYLES[setup.stylePreset] ?? STYLES.cinematic;
  const defaults =
    setup.posterType === "film" ? FILM_DEFAULTS : EXHIBITION_DEFAULTS;

  const title =
    setup.userTitle ||
    (setup.aiWriteCopy ? defaults.title : defaults.title);
  const subtitle =
    setup.userSubtitle ||
    (setup.aiWriteCopy ? defaults.subtitle : defaults.subtitle);
  const dateLocation =
    setup.userDateLocation ||
    (setup.aiWriteCopy ? defaults.dateLocation : defaults.dateLocation);
  const credits =
    setup.userCredits ||
    (setup.aiWriteCopy ? defaults.credits : defaults.credits);

  const pad = Math.round(canvas.width * 0.05);
  const innerW = canvas.width - pad * 2;

  // Title font size scales with canvas width
  const titleSize = Math.round(canvas.width * 0.1);
  const subtitleSize = Math.round(canvas.width * 0.035);
  const bodySize = Math.round(canvas.width * 0.025);

  // Layout varies by style
  let titleY: number;
  let subtitleY: number;
  let dateY: number;
  let creditsY: number;

  if (setup.stylePreset === "gallery-minimal" || setup.stylePreset === "editorial") {
    // Top-heavy: title near top
    titleY = Math.round(canvas.height * 0.07);
    subtitleY = Math.round(canvas.height * 0.21);
    dateY = Math.round(canvas.height * 0.86);
    creditsY = Math.round(canvas.height * 0.91);
  } else if (setup.stylePreset === "brutalist") {
    // Stacked at top, overlapping
    titleY = Math.round(canvas.height * 0.04);
    subtitleY = Math.round(canvas.height * 0.22);
    dateY = Math.round(canvas.height * 0.82);
    creditsY = Math.round(canvas.height * 0.89);
  } else {
    // Default: title dominates the lower third
    titleY = Math.round(canvas.height * 0.65);
    subtitleY = Math.round(canvas.height * 0.55);
    dateY = Math.round(canvas.height * 0.88);
    creditsY = Math.round(canvas.height * 0.93);
  }

  const layers: Layer[] = [
    {
      id: uuidv4(),
      type: "background-image",
      label: "Background",
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 1,
      imageData: { src: "", fit: "fill" },
    },
    {
      id: uuidv4(),
      type: "subtitle-text",
      label: "Subtitle",
      x: pad,
      y: subtitleY,
      width: innerW,
      height: Math.round(subtitleSize * 2.5),
      rotation: 0,
      opacity: 0.9,
      visible: true,
      locked: false,
      zIndex: 3,
      textData: {
        text: subtitle,
        fontSize: subtitleSize,
        fontFamily: st.subtitleFont,
        fontStyle: "normal",
        fill: st.subtitleColor,
        align: st.titleAlign,
        letterSpacing: 1,
        lineHeight: 1.3,
      },
    },
    {
      id: uuidv4(),
      type: "title-text",
      label: "Title",
      x: pad,
      y: titleY,
      width: innerW,
      height: Math.round(titleSize * 2),
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 4,
      textData: {
        text: title,
        fontSize: titleSize,
        fontFamily: st.titleFont,
        fontStyle: st.titleStyle,
        fill: st.titleColor,
        align: st.titleAlign,
        letterSpacing: st.titleLetterSpacing,
        lineHeight: 1,
      },
    },
    {
      id: uuidv4(),
      type: "date-location-text",
      label: "Date / Location",
      x: pad,
      y: dateY,
      width: innerW,
      height: Math.round(bodySize * 2),
      rotation: 0,
      opacity: 0.8,
      visible: true,
      locked: false,
      zIndex: 2,
      textData: {
        text: dateLocation,
        fontSize: bodySize,
        fontFamily: st.bodyFont,
        fontStyle: "normal",
        fill: st.bodyColor,
        align: st.titleAlign,
        letterSpacing: 2,
        lineHeight: 1.4,
      },
    },
    {
      id: uuidv4(),
      type: "credits-text",
      label: "Credits",
      x: pad,
      y: creditsY,
      width: innerW,
      height: Math.round(bodySize * 2),
      rotation: 0,
      opacity: 0.6,
      visible: true,
      locked: false,
      zIndex: 2,
      textData: {
        text: credits,
        fontSize: Math.round(bodySize * 0.8),
        fontFamily: st.bodyFont,
        fontStyle: "normal",
        fill: st.bodyColor,
        align: st.titleAlign,
        letterSpacing: 1,
        lineHeight: 1.4,
      },
    },
  ];

  return {
    layers,
    imagePrompt: `${setup.stylePreset} style poster background for: ${setup.prompt || setup.posterType}`,
    designNotes: `Demo layout — ${setup.stylePreset} style, ${setup.posterType} poster. Configure ANTHROPIC_API_KEY for AI-generated layouts.`,
  };
}
