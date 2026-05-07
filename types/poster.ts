export type PosterType = "film" | "exhibition";
export type Language = "english" | "chinese" | "bilingual";
export type StylePreset =
  | "cinematic"
  | "gallery-minimal"
  | "brutalist"
  | "editorial"
  | "surreal"
  | "experimental";

export type CanvasSize =
  | "instagram-post"
  | "instagram-story"
  | "square"
  | "a4"
  | "a3"
  | "custom";

export interface CanvasConfig {
  size: CanvasSize;
  width: number;
  height: number;
}

export type LayerType =
  | "background-image"
  | "title-text"
  | "subtitle-text"
  | "date-location-text"
  | "credits-text"
  | "foreground-cutout"
  | "user-text"
  | "user-image";

export type ImageInputMode =
  | "background"
  | "crop-to-fit"
  | "extract-subject"
  | "style-reference"
  | "no-modify";

export interface TextLayerData {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: string; // "normal", "bold", "italic", "bold italic"
  fill: string;
  align: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
}

export interface ImageLayerData {
  src: string;
  originalSrc?: string;
  fit?: "fill" | "contain" | "cover";
}

export interface Layer {
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
  textData?: TextLayerData;
  imageData?: ImageLayerData;
}

export interface PosterSetupConfig {
  posterType: PosterType;
  canvasSize: CanvasSize;
  customWidth?: number;
  customHeight?: number;
  language: Language;
  stylePreset: StylePreset;
  prompt: string;
  aiWriteCopy: boolean;
  userTitle?: string;
  userSubtitle?: string;
  userDateLocation?: string;
  userCredits?: string;
}

export interface PosterProject {
  id: string;
  userId: string;
  title: string;
  canvas: CanvasConfig;
  layers: Layer[];
  stylePreset: StylePreset;
  posterType: PosterType;
  language: Language;
  promptHistory: string[];
  lockedLayers: string[];
  thumbnail?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CANVAS_SIZES: Record<Exclude<CanvasSize, "custom">, CanvasConfig> =
  {
    "instagram-post": { size: "instagram-post", width: 1080, height: 1080 },
    "instagram-story": { size: "instagram-story", width: 1080, height: 1920 },
    square: { size: "square", width: 800, height: 800 },
    a4: { size: "a4", width: 794, height: 1123 },
    a3: { size: "a3", width: 1123, height: 1587 },
  };

export const DISPLAY_SCALE = 0.5;
