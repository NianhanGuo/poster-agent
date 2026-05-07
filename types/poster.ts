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
  | "experimental-type";

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
  | "background"
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
  | "userImage";

export function isTextLayer(type: LayerType): boolean {
  return type.endsWith("Text");
}

export function isImageLayer(type: LayerType): boolean {
  return !type.endsWith("Text");
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

export interface ImageLayerData {
  src: string;
  originalSrc?: string;
  fit?: "fill" | "contain" | "cover";
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

export interface ReferenceConfig {
  imageUrl: string | null;
  strength: number; // 0–100
  targets: {
    mood: boolean;
    color: boolean;
    backgroundStyle: boolean;
    typography: boolean;
    layout: boolean;
    texture: boolean;
    lighting: boolean;
  };
  instruction: string;
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
