// ─── Primitive types ──────────────────────────────────────────────────────────

export type PosterType = "film" | "exhibition";
export type Language = "en" | "zh" | "mixed";

export type StyleRecipe =
  | "cinematic-rain"
  | "gallery-minimal"
  | "brutalist-wall"
  | "soft-editorial"
  | "surreal-film"
  | "archive-museum"
  | "experimental-type"
  | "blur-field";

export type CanvasSize =
  | "instagram-post"
  | "instagram-story"
  | "square"
  | "a4"
  | "a3"
  | "custom";

export type ImageSource = "generate" | "upload" | "reference";

export type ImageStyle =
  | "cinematic-photography"
  | "abstract"
  | "collage"
  | "minimal-graphic"
  | "painterly"
  | "custom";

export type ImageInputMode =
  | "new-layer"
  | "background"
  | "foreground"
  | "texture"
  | "reference"
  | "crop-to-fit"
  | "extract-subject"
  | "style-reference"
  | "no-modify";

// ─── Canvas ───────────────────────────────────────────────────────────────────

export interface CanvasConfig {
  size: CanvasSize;
  width: number;
  height: number;
}

// ─── Layers ───────────────────────────────────────────────────────────────────

export type LayerType =
  | "backgroundImage"
  | "subjectImage"
  | "titleText"
  | "subtitleText"
  | "metaText"
  | "bodyText"
  | "foregroundCutout"
  | "userText"
  | "userImage"
  | "drawingLayer"
  | "gradientLayer"
  | "textureLayer";

const TEXT_LAYER_TYPES = new Set<LayerType>([
  "titleText", "subtitleText", "metaText", "bodyText", "userText",
]);

export function isTextLayer(type: LayerType): boolean {
  return TEXT_LAYER_TYPES.has(type);
}

export function isImageLayer(type: LayerType): boolean {
  return !TEXT_LAYER_TYPES.has(type);
}

export interface TextLayerData {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: string;       // Konva fontStyle: "normal" | "italic" | "bold" | "bold italic"
  fontWeight?: number;     // 100–900; used to build fontStyle and load Google Font variant
  italic?: boolean;
  fill: string;
  align: "left" | "center" | "right" | "justify";
  letterSpacing?: number;
  lineHeight?: number;
  // Decoration
  textDecoration?: string; // "" | "underline" | "line-through" | "underline line-through"
  // Outline / stroke
  stroke?: string;
  strokeWidth?: number;
  // Drop shadow
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowBlur?: number;
  // Text gradient fill (overrides fill when set)
  fillGradient?: string;   // gradient preset id from GRADIENT_PRESETS
  // Active effect ids (from EFFECTS list)
  effects?: string[];
}

export type BlendMode =
  | "normal" | "multiply" | "screen" | "overlay"
  | "soft-light" | "hard-light" | "color-dodge" | "color-burn"
  | "darken" | "lighten" | "color" | "luminosity" | "difference" | "exclusion";

export interface ImageAdjustments {
  brightness: number;   // -100 to 100
  contrast: number;     // -100 to 100
  saturation: number;   // -100 to 100
  temperature: number;  // -100 to 100
  highlights: number;   // -100 to 100
  shadows: number;      // -100 to 100
}

export interface ImageLayerData {
  src: string;
  originalSrc?: string;
  fit?: "fill" | "contain" | "cover";
  adjustments?: ImageAdjustments;
}

export interface PosterLayer {
  id: string;
  type: LayerType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  isForeground?: boolean;
  blendMode?: BlendMode;
  textData?: TextLayerData;
  imageData?: ImageLayerData;
}

/** @deprecated Use PosterLayer */
export type Layer = PosterLayer;

// ─── Setup config ─────────────────────────────────────────────────────────────

export interface PosterSetupConfig {
  posterType: PosterType;
  canvasSize: CanvasSize;
  customWidth?: number;
  customHeight?: number;
  language: Language;
  styleRecipe: StyleRecipe;
  imageSource: ImageSource;
  imageStyle: ImageStyle;
  customImagePrompt?: string;
  prompt: string;
  aiWriteCopy: boolean;
  userTitle?: string;
  userSubtitle?: string;
  userDateLocation?: string;
  userCredits?: string;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface PosterProject {
  id: string;
  userId: string;
  title: string;
  canvas: CanvasConfig;
  layers: PosterLayer[];
  styleRecipe: StyleRecipe;
  posterType: PosterType;
  language: Language;
  promptHistory: string[];
  lockedLayers: string[];
  thumbnail?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Design brief ─────────────────────────────────────────────────────────────

export interface DesignBrief {
  mood: string;
  composition: "center" | "asymmetric" | "grid" | "edge-heavy";
  typographyStrategy: "dominant-title" | "subtle-type" | "layered-type";
  colorStrategy: "high-contrast" | "muted" | "monochrome" | "duotone";
  imageStrategy: "background-hero" | "abstract" | "texture" | "empty";
  negativeSpace: "high" | "medium" | "low";
  designRationale?: string;
}

export interface ProjectVersion {
  project: PosterProject;
  brief?: DesignBrief;
  timestamp: string;
}

// ─── Reference image ──────────────────────────────────────────────────────────

export type { PaletteColor } from "@/lib/colorExtract";

// Structured result from GPT-4o vision analysis of a reference image
export interface ReferenceAnalysis {
  palette: string[];        // hex values ordered dominant → least
  mood: string;
  composition: string;      // spatial layout zones (top/center/bottom + focal hierarchy)
  typographyStyle: string;  // text placement, weight, size, spacing, rotation
  shapes: string;           // shape primitives: circles, gradients, blobs, geometry
  blurMap: string;          // blur distribution across spatial zones
  texture: string;
  lighting: string;
  visualSummary: string;
  // Hard-constraint fields — used for enforced generation
  brightness: "light" | "medium" | "dark";
  contrast: "low" | "medium" | "high";
  styleClass: "abstract-poster" | "blurred-gradient" | "geometric-graphic" | "photographic" | "illustration" | "typographic";
  forbiddenDrift: string[];  // auto-generated terms the output must never become
}

export type ReferenceMode = "loose" | "balanced" | "strict";
export type ReferenceRole = "primary" | "secondary" | "accent";

export type ReferenceTargets = {
  mood: boolean;
  color: boolean;
  backgroundStyle: boolean;
  typography: boolean;
  layout: boolean;
  texture: boolean;
  lighting: boolean;
};

// A single reference image in the multi-reference system
export interface ReferenceImage {
  id: string;
  imageUrl: string;
  label: string;
  mode: ReferenceMode;
  role: ReferenceRole;
  strength: number;   // 0–100 fine-tune within mode
  palette: import("@/lib/colorExtract").PaletteColor[];
  paletteError: string;
  analysis: ReferenceAnalysis | null;
  analysisError: string;
  analyzing: boolean;
}

export interface ReferenceConfig {
  // Legacy single-image (backward compat for existing code)
  imageUrl: string | null;
  strength: number;
  targets: ReferenceTargets;
  instruction: string;
  palette: import("@/lib/colorExtract").PaletteColor[];
  paletteError: string;
  analysis: ReferenceAnalysis | null;
  analysisError: string;

  // Multi-reference (new)
  images: ReferenceImage[];
  globalInstruction: string;
}

export const DEFAULT_REFERENCE: ReferenceConfig = {
  imageUrl: null,
  strength: 50,
  targets: {
    mood: true,
    color: true,
    backgroundStyle: false,
    typography: false,
    layout: false,
    texture: false,
    lighting: false,
  },
  instruction: "",
  palette: [],
  paletteError: "",
  analysis: null,
  analysisError: "",
  images: [],
  globalInstruction: "",
};

// ─── Asset library ────────────────────────────────────────────────────────────

export interface AssetItem {
  id: string;
  userId: string;
  imageUrl: string;
  fileName: string;
  createdAt: string;
  tags?: string[];
  usageType?: "background" | "subject" | "reference" | "texture";
  generatedTag?: string; // "from reference" | "variation" etc.
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const CANVAS_PRESETS: Record<Exclude<CanvasSize, "custom">, CanvasConfig> = {
  "instagram-post":  { size: "instagram-post",  width: 1080, height: 1080 },
  "instagram-story": { size: "instagram-story", width: 1080, height: 1920 },
  square:            { size: "square",           width: 800,  height: 800  },
  a4:                { size: "a4",               width: 794,  height: 1123 },
  a3:                { size: "a3",               width: 1123, height: 1587 },
};

// Keep old name for backward compat in existing route that imports it
export const CANVAS_SIZES = CANVAS_PRESETS;
