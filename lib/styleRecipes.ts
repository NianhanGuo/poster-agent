import type { StyleRecipe } from "@/types/poster";

export interface RecipeDef {
  id: StyleRecipe;
  name: string;
  tagline: string;
  // Image generation directives
  imageKeywords: string;
  imageAvoid: string;
  // Color palette for gradients and mock
  palette: { bg: string; surface: string; text: string; accent: string };
  // Typography defaults
  type: {
    titleFamily: string;
    bodyFamily: string;
    titleWeight: string;
    titleAlign: "left" | "center" | "right";
    titleLetterSpacing: number;
    titleColor: string;
    bodyColor: string;
  };
  // Layout behavior
  layout: {
    titlePosition: "top" | "bottom" | "center" | "off-center";
    align: "left" | "center" | "right";
    density: "sparse" | "moderate" | "dense";
  };
  /**
   * When set, this recipe uses the collage composition pipeline instead of
   * the standard image-generation pipeline.
   */
  collageMode?: {
    requiresImages: true;
    minImages: number;
    maxImages: number;
    /** Run @imgly/background-removal automatically on each uploaded image */
    autoExtractSubjects: boolean;
    /** Convert extracted subjects to grayscale before compositing */
    autoGrayscale: boolean;
    /** Skip Flux image generation entirely — use solidBackground only */
    noFluxGeneration: boolean;
  };
}

export const RECIPES: Record<StyleRecipe, RecipeDef> = {

  // ── Product Exhibit (commercial product advertisement) ─────────────────────
  "product-exhibit": {
    id: "product-exhibit",
    name: "Product Exhibit",
    tagline: "Commercial hero advertising for any product",
    imageKeywords:
      "commercial product photography, hero shot, professional studio lighting, clean background, sharp focus, advertising quality",
    imageAvoid: "text, watermarks, logos, cluttered backgrounds, busy patterns",
    palette: {
      bg:      "#1a1a1a",
      surface: "#2d2d2d",
      text:    "#f5f5f0",
      accent:  "#f5c400",
    },
    type: {
      titleFamily:        "Playfair Display",
      bodyFamily:         "Inter",
      titleWeight:        "700",
      titleAlign:         "left",
      titleLetterSpacing: 0,
      titleColor:         "#f5f5f0",
      bodyColor:          "#cccccc",
    },
    layout: {
      titlePosition: "top",
      align:         "left",
      density:       "moderate",
    },
  },

  // ── Collage Poster (composition-first, uploaded images only) ───────────────
  "collage-poster": {
    id: "collage-poster",
    name: "Collage Poster",
    tagline: "Cutout subjects, geometric blocks, integrated type",
    imageKeywords: "",
    imageAvoid: "",
    palette: {
      bg:      "#f4f4f0",
      surface: "#ffffff",
      text:    "#0a0a0a",
      accent:  "#d63c2a",
    },
    type: {
      titleFamily:        "Bebas Neue",
      bodyFamily:         "Space Mono",
      titleWeight:        "400",
      titleAlign:         "left",
      titleLetterSpacing: 2,
      titleColor:         "#0a0a0a",
      bodyColor:          "#0a0a0a",
    },
    layout: {
      titlePosition: "off-center",
      align:         "left",
      density:       "dense",
    },
    collageMode: {
      requiresImages:      true,
      minImages:           1,
      maxImages:           3,
      autoExtractSubjects: true,
      autoGrayscale:       true,
      noFluxGeneration:    true,
    },
  },

  // ── Legacy: kept for backward compatibility with saved projects ────────────
  "surreal-film": {
    id: "surreal-film",
    name: "Surreal Film",
    tagline: "Between waking and dream",
    imageKeywords:
      "surreal, dreamlike, double exposure, ethereal light, mist, otherworldly, symbolic, Magritte, Tarkovsky",
    imageAvoid: "realistic documentary, mundane, flat, literal",
    palette: {
      bg: "#0e0a1e",
      surface: "#160d28",
      text: "#d8c8f0",
      accent: "#9060c0",
    },
    type: {
      titleFamily: "Palatino",
      bodyFamily: "Arial",
      titleWeight: "normal",
      titleAlign: "center",
      titleLetterSpacing: 6,
      titleColor: "#e8d8ff",
      bodyColor: "#8868aa",
    },
    layout: {
      titlePosition: "off-center",
      align: "center",
      density: "sparse",
    },
  },

  "cinematic-rain": {
    id: "cinematic-rain",
    name: "Cinematic Rain",
    tagline: "Dark atmosphere, dramatic light",
    imageKeywords:
      "cinematic, anamorphic lens, rain, fog, dramatic lighting, dark atmosphere, film grain, 35mm, shallow depth of field, chiaroscuro",
    imageAvoid: "text, watermarks, logos, bright colors, flat lighting",
    palette: {
      bg: "#05050a",
      surface: "#0d0d1a",
      text: "#f5f0e8",
      accent: "#c8a96e",
    },
    type: {
      titleFamily: "Impact",
      bodyFamily: "Helvetica Neue",
      titleWeight: "normal",
      titleAlign: "center",
      titleLetterSpacing: 12,
      titleColor: "#ffffff",
      bodyColor: "#999999",
    },
    layout: {
      titlePosition: "bottom",
      align: "center",
      density: "sparse",
    },
  },

  "gallery-minimal": {
    id: "gallery-minimal",
    name: "Gallery Minimal",
    tagline: "White space is the statement",
    imageKeywords:
      "minimal, architectural, abstract geometry, clean lines, neutral tones, gallery photography, sculptural, monochrome",
    imageAvoid:
      "text, busy compositions, bright colors, noise, people, objects",
    palette: {
      bg: "#f2f0eb",
      surface: "#e8e5de",
      text: "#1a1a1a",
      accent: "#888880",
    },
    type: {
      titleFamily: "Georgia",
      bodyFamily: "Arial",
      titleWeight: "normal",
      titleAlign: "left",
      titleLetterSpacing: 0,
      titleColor: "#111111",
      bodyColor: "#555555",
    },
    layout: {
      titlePosition: "top",
      align: "left",
      density: "sparse",
    },
  },

  "brutalist-wall": {
    id: "brutalist-wall",
    name: "Brutalist Wall",
    tagline: "Raw force, maximum contrast",
    imageKeywords:
      "concrete, brutalist architecture, raw texture, industrial, high contrast, black and white, gritty, urban",
    imageAvoid: "soft light, pastel, decorative, ornate",
    palette: {
      bg: "#0a0a0a",
      surface: "#111111",
      text: "#f0f0f0",
      accent: "#cc2200",
    },
    type: {
      titleFamily: "Impact",
      bodyFamily: "Courier New",
      titleWeight: "bold",
      titleAlign: "left",
      titleLetterSpacing: -2,
      titleColor: "#ffffff",
      bodyColor: "#aaaaaa",
    },
    layout: {
      titlePosition: "top",
      align: "left",
      density: "dense",
    },
  },

  "soft-editorial": {
    id: "soft-editorial",
    name: "Soft Editorial",
    tagline: "Restrained warmth, literary tone",
    imageKeywords:
      "editorial photography, warm tones, analog, grain, soft focus, contemplative, still life, intimate",
    imageAvoid: "harsh contrast, digital sharpness, bright neon, action",
    palette: {
      bg: "#1a1714",
      surface: "#211e1a",
      text: "#e8dcc8",
      accent: "#b8a080",
    },
    type: {
      titleFamily: "Palatino",
      bodyFamily: "Georgia",
      titleWeight: "normal",
      titleAlign: "center",
      titleLetterSpacing: 3,
      titleColor: "#f0e8d8",
      bodyColor: "#888070",
    },
    layout: {
      titlePosition: "center",
      align: "center",
      density: "moderate",
    },
  },

  "archive-museum": {
    id: "archive-museum",
    name: "Archive Museum",
    tagline: "Institutional, authoritative",
    imageKeywords:
      "archival documentary, museum quality, historical, desaturated, formal composition, artifact, institutional",
    imageAvoid: "modern digital, bright colors, casual, experimental",
    palette: {
      bg: "#f5f2ec",
      surface: "#ece8e0",
      text: "#1e1c18",
      accent: "#1a3a6e",
    },
    type: {
      titleFamily: "Georgia",
      bodyFamily: "Times New Roman",
      titleWeight: "normal",
      titleAlign: "left",
      titleLetterSpacing: 4,
      titleColor: "#1a1814",
      bodyColor: "#4a4640",
    },
    layout: {
      titlePosition: "top",
      align: "left",
      density: "dense",
    },
  },

  "experimental-type": {
    id: "experimental-type",
    name: "Experimental Type",
    tagline: "Typography is the image",
    imageKeywords:
      "minimal abstract, texture, typographic, graphic, flat plane, geometric, high contrast pattern",
    imageAvoid: "photographic realism, people, narrative",
    palette: {
      bg: "#080808",
      surface: "#111111",
      text: "#f8f8f8",
      accent: "#e8e800",
    },
    type: {
      titleFamily: "Courier New",
      bodyFamily: "Courier New",
      titleWeight: "bold",
      titleAlign: "right",
      titleLetterSpacing: -3,
      titleColor: "#ffffff",
      bodyColor: "#666666",
    },
    layout: {
      titlePosition: "off-center",
      align: "right",
      density: "moderate",
    },
  },

  "blur-field": {
    id: "blur-field",
    name: "Blur Field",
    tagline: "Soft light, airy geometry, gallery calm",
    imageKeywords:
      "abstract color field, blurred translucent geometric shapes, soft overlapping circles and rectangles, pastel gradients, diffused light, muted lavender cyan pink cream, paper texture, subtle grain, large negative space, contemporary gallery poster, atmospheric",
    imageAvoid:
      "realistic landscapes, characters, faces, literal objects, sharp icons, text, logos, AI fantasy scenes, saturated neon, hard edges",
    palette: {
      bg: "#f0eff8",
      surface: "#e4dff0",
      text: "#2a2630",
      accent: "#7b6ea6",
    },
    type: {
      titleFamily: "Helvetica Neue",
      bodyFamily: "Helvetica Neue",
      titleWeight: "300",
      titleAlign: "left",
      titleLetterSpacing: 8,
      titleColor: "#2a2630",
      bodyColor: "#7b7490",
    },
    layout: {
      titlePosition: "off-center",
      align: "left",
      density: "sparse",
    },
  },
};

/** Active recipes shown in the style picker — excludes legacy backward-compat entries */
export const RECIPE_LIST = Object.values(RECIPES).filter(
  (r) => r.id !== "cinematic-rain" && r.id !== "surreal-film",
);
