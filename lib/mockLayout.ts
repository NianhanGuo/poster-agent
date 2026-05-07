import { v4 as uuidv4 } from "uuid";
import type { PosterLayer, CanvasConfig, PosterSetupConfig } from "@/types/poster";
import { RECIPES } from "@/lib/styleRecipes";

// Opinionated, design-forward mock layouts — one per style recipe.
// Used when ANTHROPIC_API_KEY is absent.

function p(canvas: CanvasConfig, rx: number, ry: number) {
  return { x: Math.round(canvas.width * rx), y: Math.round(canvas.height * ry) };
}

function bg(canvas: CanvasConfig): PosterLayer {
  return {
    id: uuidv4(),
    type: "backgroundImage",
    label: "Background",
    x: 0, y: 0,
    width: canvas.width, height: canvas.height,
    rotation: 0, opacity: 1,
    visible: true, locked: false, zIndex: 1,
    imageData: { src: "", fit: "fill" },
  };
}

function textLayer(
  type: PosterLayer["type"],
  label: string,
  text: string,
  x: number, y: number,
  width: number,
  fontSize: number,
  fontFamily: string,
  fontStyle: string,
  fill: string,
  align: "left" | "center" | "right",
  letterSpacing: number,
  zIndex: number,
  opacity = 1,
  rotation = 0,
): PosterLayer {
  return {
    id: uuidv4(), type, label,
    x, y, width,
    height: Math.round(fontSize * 2.4),
    rotation, opacity,
    visible: true, locked: false, zIndex,
    textData: {
      text, fontSize, fontFamily, fontStyle, fill, align,
      letterSpacing, lineHeight: 1.1,
    },
  };
}

export function mockLayout(
  setup: PosterSetupConfig,
  canvas: CanvasConfig,
): { layers: PosterLayer[]; imagePrompt: string; designNotes: string } {
  const recipe = RECIPES[setup.styleRecipe] ?? RECIPES["cinematic-rain"];
  const t = recipe.type;
  const pad = Math.round(canvas.width * 0.05);
  const inner = canvas.width - pad * 2;

  const title   = setup.userTitle       || (setup.aiWriteCopy ? filmOrExhibitionTitle(setup.posterType)   : "—");
  const sub     = setup.userSubtitle    || (setup.aiWriteCopy ? filmOrExhibitionSub(setup.posterType)     : "");
  const meta    = setup.userDateLocation|| (setup.aiWriteCopy ? filmOrExhibitionMeta(setup.posterType)    : "");
  const credits = setup.userCredits     || (setup.aiWriteCopy ? filmOrExhibitionCredits(setup.posterType) : "");

  const titleSize  = Math.round(canvas.width * 0.1);
  const subSize    = Math.round(canvas.width * 0.035);
  const metaSize   = Math.round(canvas.width * 0.022);
  const creditSize = Math.round(canvas.width * 0.017);

  let layers: PosterLayer[];

  switch (setup.styleRecipe) {
    case "cinematic-rain":
      // Large title at bottom, subtitle above it, credits tiny at very bottom
      layers = [
        bg(canvas),
        textLayer("subtitleText", "Subtitle", sub,
          pad, Math.round(canvas.height * 0.56), inner,
          subSize, "Helvetica Neue", "normal", "#aaaaaa", "center", 6, 3),
        textLayer("titleText", "Title", title.toUpperCase(),
          pad, Math.round(canvas.height * 0.63), inner,
          titleSize, "Impact", "normal", "#ffffff", "center", 14, 4),
        textLayer("metaText", "Meta", meta,
          pad, Math.round(canvas.height * 0.88), inner,
          metaSize, "Helvetica Neue", "normal", "#666666", "center", 2, 2),
        textLayer("bodyText", "Credits", credits,
          pad, Math.round(canvas.height * 0.93), inner,
          creditSize, "Helvetica Neue", "normal", "#444444", "center", 1, 2),
      ];
      break;

    case "gallery-minimal":
      // Small title top-left, large empty center, minimal credits bottom-right
      layers = [
        bg(canvas),
        textLayer("titleText", "Title", title,
          pad, pad, Math.round(inner * 0.55),
          Math.round(titleSize * 0.55), "Georgia", "normal", "#111111", "left", 0, 4),
        textLayer("subtitleText", "Subtitle", sub,
          pad, Math.round(canvas.height * 0.18), Math.round(inner * 0.6),
          subSize, "Arial", "normal", "#555555", "left", 0, 3),
        textLayer("metaText", "Date / Venue", meta,
          pad, Math.round(canvas.height * 0.87), inner,
          metaSize, "Arial", "normal", "#333333", "left", 4, 2),
        textLayer("bodyText", "Credits", credits,
          pad, Math.round(canvas.height * 0.92), inner,
          creditSize, "Arial", "normal", "#888888", "left", 2, 2),
      ];
      break;

    case "brutalist-wall":
      // Title overwhelming, top-left bleed, raw
      layers = [
        bg(canvas),
        textLayer("titleText", "Title", title.toUpperCase(),
          pad, Math.round(canvas.height * 0.04), inner,
          Math.round(titleSize * 1.3), "Impact", "bold", "#ffffff", "left", -3, 4),
        textLayer("subtitleText", "Subtitle", sub.toUpperCase(),
          pad, Math.round(canvas.height * 0.28), Math.round(inner * 0.7),
          subSize, "Courier New", "bold", "#cc2200", "left", 4, 3),
        textLayer("metaText", "Meta", meta,
          pad, Math.round(canvas.height * 0.85), inner,
          metaSize, "Courier New", "normal", "#aaaaaa", "left", 2, 2),
        textLayer("bodyText", "Credits", credits,
          pad, Math.round(canvas.height * 0.91), inner,
          creditSize, "Courier New", "normal", "#666666", "left", 1, 2),
      ];
      break;

    case "soft-editorial":
      // Centered, warm, layered hierarchy
      layers = [
        bg(canvas),
        textLayer("subtitleText", "Subtitle", sub,
          pad, Math.round(canvas.height * 0.38), inner,
          subSize, "Georgia", "italic", "#b8a080", "center", 3, 3),
        textLayer("titleText", "Title", title,
          pad, Math.round(canvas.height * 0.44), inner,
          Math.round(titleSize * 0.8), "Palatino", "normal", "#f0e8d8", "center", 4, 4),
        textLayer("metaText", "Meta", meta,
          pad, Math.round(canvas.height * 0.75), inner,
          metaSize, "Georgia", "normal", "#888070", "center", 2, 2),
        textLayer("bodyText", "Credits", credits,
          pad, Math.round(canvas.height * 0.81), inner,
          creditSize, "Georgia", "normal", "#665850", "center", 1, 2),
      ];
      break;

    case "surreal-film":
      // Off-center, dreamlike, loose placement
      layers = [
        bg(canvas),
        textLayer("titleText", "Title", title,
          Math.round(pad * 0.5), Math.round(canvas.height * 0.42), Math.round(inner * 1.1),
          Math.round(titleSize * 0.85), "Palatino", "italic", "#e8d8ff", "center", 8, 4),
        textLayer("subtitleText", "Subtitle", sub,
          pad, Math.round(canvas.height * 0.60), inner,
          subSize, "Arial", "normal", "#9060c0", "center", 3, 3),
        textLayer("metaText", "Meta", meta,
          pad, Math.round(canvas.height * 0.86), inner,
          metaSize, "Arial", "normal", "#6648aa", "right", 1, 2),
        textLayer("bodyText", "Credits", credits,
          pad, Math.round(canvas.height * 0.92), inner,
          creditSize, "Arial", "normal", "#443366", "right", 1, 2),
      ];
      break;

    case "archive-museum":
      // Formal, information-rich, grid-precise
      layers = [
        bg(canvas),
        textLayer("titleText", "Title", title.toUpperCase(),
          pad, pad, inner,
          Math.round(titleSize * 0.65), "Georgia", "normal", "#1a1814", "left", 6, 4),
        textLayer("subtitleText", "Subtitle", sub,
          pad, Math.round(canvas.height * 0.15), Math.round(inner * 0.7),
          Math.round(subSize * 0.9), "Times New Roman", "italic", "#4a4640", "left", 2, 3),
        // Horizontal rule simulated with long underscore text
        textLayer("metaText", "Date / Venue", meta,
          pad, Math.round(canvas.height * 0.82), inner,
          Math.round(metaSize * 1.1), "Times New Roman", "normal", "#1a1814", "left", 6, 2),
        textLayer("bodyText", "Credits", credits,
          pad, Math.round(canvas.height * 0.88), inner,
          creditSize, "Times New Roman", "normal", "#6a6660", "left", 2, 2),
      ];
      break;

    case "experimental-type":
    default:
      // Type as composition — large rotated title, extreme contrast
      layers = [
        bg(canvas),
        // Rotated title
        textLayer("titleText", "Title", title.toUpperCase(),
          Math.round(canvas.width * 0.1), Math.round(canvas.height * 0.55), Math.round(inner * 1.4),
          Math.round(titleSize * 1.1), "Courier New", "bold", "#ffffff", "left", -4, 4, 1, -8),
        textLayer("subtitleText", "Subtitle", sub,
          pad, Math.round(canvas.height * 0.07), inner,
          subSize, "Courier New", "normal", "#666666", "right", 2, 3),
        textLayer("metaText", "Meta", meta,
          pad, Math.round(canvas.height * 0.85), inner,
          metaSize, "Courier New", "normal", "#444444", "right", 0, 2),
        textLayer("bodyText", "Credits", credits,
          pad, Math.round(canvas.height * 0.91), inner,
          creditSize, "Courier New", "normal", "#333333", "right", 0, 2),
      ];
      break;
  }

  return {
    layers,
    imagePrompt: `${recipe.imageKeywords}. ${setup.prompt || setup.posterType + " poster"}. ${recipe.imageAvoid ? "Avoid: " + recipe.imageAvoid : ""}`,
    designNotes: `${recipe.name} — demo layout. Add ANTHROPIC_API_KEY for AI-generated layouts.`,
  };
}

// ─── Default copy helpers ─────────────────────────────────────────────────────

function filmOrExhibitionTitle(type: string) {
  return type === "film" ? "UNTITLED" : "EXHIBITION";
}
function filmOrExhibitionSub(type: string) {
  return type === "film" ? "A film" : "Works 2024–2025";
}
function filmOrExhibitionMeta(type: string) {
  return type === "film" ? "Coming soon" : "1 Jan – 28 Feb 2026";
}
function filmOrExhibitionCredits(type: string) {
  return type === "film"
    ? "Written & Directed by —"
    : "Gallery — City, Country";
}
