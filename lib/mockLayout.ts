import { v4 as uuidv4 } from "uuid";
import type { PosterLayer, CanvasConfig, PosterSetupConfig, ShapeLayerData, OverlayLayerData } from "@/types/poster";

// Rich 8-layer "Cannes 2026" film festival demo poster.
// Used when OPENAI_API_KEY is absent.

export function mockLayout(
  _setup: PosterSetupConfig,
  canvas: CanvasConfig,
): {
  layers: PosterLayer[];
  imagePrompt: string;
  fluxPrompt: string;
  designNotes: string;
  designRationale: string;
  fonts: { display: string; body: string };
  palette: { dominant: string; secondary: string; accent: string; background: string };
} {
  const s = canvas.width / 794; // scale factor relative to A4

  const layers: PosterLayer[] = [
    // L1 — backgroundImage
    {
      id: uuidv4(),
      type: "backgroundImage",
      label: "Background Photo",
      x: 0, y: 0,
      width: canvas.width,
      height: canvas.height,
      rotation: 0, opacity: 1,
      visible: true, locked: false, zIndex: 0,
      imageData: { src: "", fit: "fill" },
    },

    // L2 — colorOverlay (multiply gradient wash)
    {
      id: uuidv4(),
      type: "colorOverlay",
      label: "Tone Wash",
      x: 0, y: 0,
      width: canvas.width,
      height: canvas.height,
      rotation: 0, opacity: 1,
      visible: true, locked: false, zIndex: 1,
      blendMode: "multiply",
      overlayData: {
        gradientType: "linear",
        colors: ["rgba(0,0,0,0.7)", "rgba(20,10,40,0.4)", "rgba(0,0,0,0.85)"],
        direction: 180,
        opacity: 1,
      } satisfies OverlayLayerData,
    },

    // L3 — noiseTexture (tactile grain)
    {
      id: uuidv4(),
      type: "noiseTexture",
      label: "Film Grain",
      x: 0, y: 0,
      width: canvas.width,
      height: canvas.height,
      rotation: 0, opacity: 0.05,
      visible: true, locked: false, zIndex: 2,
    },

    // L4 — geometricShape (left-edge gold vertical bar)
    {
      id: uuidv4(),
      type: "geometricShape",
      label: "Gold Rule",
      x: Math.round(40 * s),
      y: Math.round(80 * s),
      width: Math.round(3 * s),
      height: Math.round(canvas.height * 0.4),
      rotation: 0, opacity: 1,
      visible: true, locked: false, zIndex: 3,
      shapeData: {
        shapeType: "rect",
        fill: "#c8a96e",
        stroke: "none",
        strokeWidth: 0,
      } satisfies ShapeLayerData,
    },

    // L5 — accentLine (horizontal gold rule)
    {
      id: uuidv4(),
      type: "accentLine",
      label: "Accent Line",
      x: Math.round(40 * s),
      y: Math.round(canvas.height * 0.72),
      width: Math.round((canvas.width - 80) * s),
      height: 1,
      rotation: 0, opacity: 1,
      visible: true, locked: false, zIndex: 4,
      shapeData: {
        shapeType: "line",
        fill: "none",
        stroke: "rgba(200,169,110,0.5)",
        strokeWidth: 1,
      } satisfies ShapeLayerData,
    },

    // L6 — metaText (vertical edge text)
    {
      id: uuidv4(),
      type: "metaText",
      label: "Festival Meta",
      x: Math.round(14 * s),
      y: Math.round(canvas.height * 0.55),
      width: Math.round(160 * s),
      height: Math.round(20 * s),
      rotation: -90, opacity: 1,
      visible: true, locked: false, zIndex: 5,
      textData: {
        text: "FESTIVAL DE CANNES · 2026",
        fontSize: Math.round(11 * s),
        fontFamily: "Space Mono",
        fontStyle: "normal",
        fontWeight: 400,
        fill: "#9a8a6a",
        align: "left",
        letterSpacing: 4,
        lineHeight: 1.2,
        writingMode: "horizontal", // rotation already handles vertical placement
      },
    },

    // L7 — subtitleText
    {
      id: uuidv4(),
      type: "subtitleText",
      label: "Subtitle",
      x: Math.round(60 * s),
      y: Math.round(canvas.height * 0.68),
      width: Math.round(canvas.width * 0.7),
      height: Math.round(36 * s),
      rotation: 0, opacity: 1,
      visible: true, locked: false, zIndex: 6,
      textData: {
        text: "Une œuvre de luminosité",
        fontSize: Math.round(22 * s),
        fontFamily: "Cormorant Garamond",
        fontStyle: "italic",
        fontWeight: 300,
        fill: "#d4c4a0",
        align: "left",
        letterSpacing: 1,
        lineHeight: 1.3,
      },
    },

    // L8 — titleText (dominant, edge-to-edge)
    {
      id: uuidv4(),
      type: "titleText",
      label: "Title",
      x: Math.round(40 * s),
      y: Math.round(canvas.height * 0.74),
      width: Math.round((canvas.width - 60) * s),
      height: Math.round(200 * s),
      rotation: 0, opacity: 1,
      visible: true, locked: false, zIndex: 7,
      textData: {
        text: "LA DERNIÈRE\nLUMIÈRE",
        fontSize: Math.round(100 * s),
        fontFamily: "Anton",
        fontStyle: "normal",
        fontWeight: 400,
        fill: "#ffffff",
        align: "left",
        letterSpacing: 4,
        lineHeight: 0.92,
        textTransform: "uppercase",
      },
    },
  ];

  return {
    layers,
    imagePrompt: "Vast empty cinema auditorium. Velvet red seats receding into darkness. Single beam of projection light cutting through dust-filled air. Deep shadows, golden highlights. No faces, no people, no text. Pure atmosphere.",
    fluxPrompt: "Vast empty cinema auditorium interior, velvet red seats receding into deep darkness, single beam of warm projection light cutting through dust-filled air, golden highlights, extreme depth of field, cinematic composition, noir atmosphere. No faces, no people, no text, no letters, no typography.",
    designNotes: "Demo layout — add API keys to generate custom designs.",
    designRationale: "The title bleeds edge-to-edge in condensed impact type, creating cinematic scale. A vertical rule and gold accent line impose Swiss grid discipline against the atmospheric backdrop.",
    fonts: { display: "Anton", body: "Cormorant Garamond" },
    palette: { dominant: "#0a0a12", secondary: "#c8a96e", accent: "#ffffff", background: "#0a0a12" },
  };
}
