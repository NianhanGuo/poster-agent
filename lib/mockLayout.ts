import { v4 as uuidv4 } from "uuid";
import type { PosterLayer, CanvasConfig, PosterSetupConfig, ShapeLayerData, ClipShape } from "@/types/poster";

// Swiss International Style / Bauhaus demo — "Cannes 2026"
// Demonstrates geometry-first design: solidBackground + clipped image + geometric echo.
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
  const W = canvas.width;
  const H = canvas.height;
  const s = W / 794; // scale factor relative to A4

  // Clip zone: right 52% of canvas — image is contained here
  const clipX = Math.round(W * 0.48);
  const clipW = W - clipX;

  const clipShape: ClipShape = {
    type: "rect",
    x: clipX,
    y: 0,
    width: clipW,
    height: H,
  };

  const layers: PosterLayer[] = [
    // L1 — solidBackground: deep navy, the primary canvas
    {
      id: uuidv4(),
      type: "solidBackground",
      label: "Background",
      x: 0, y: 0,
      width: W, height: H,
      rotation: 0, opacity: 1,
      visible: true, locked: true, zIndex: 0,
      shapeData: {
        shapeType: "rect",
        fill: "#0f0f1a",
        stroke: "none",
        strokeWidth: 0,
      } satisfies ShapeLayerData,
    },

    // L2 — backgroundImage: clipped to right column
    {
      id: uuidv4(),
      type: "backgroundImage",
      label: "Background Photo",
      x: clipX,
      y: 0,
      width: clipW,
      height: H,
      rotation: 0, opacity: 1,
      visible: true, locked: false, zIndex: 1,
      imageData: { src: "", fit: "cover" },
      clipShape,
    },

    // L3 — noiseTexture: tactile grain over entire canvas
    {
      id: uuidv4(),
      type: "noiseTexture",
      label: "Film Grain",
      x: 0, y: 0,
      width: W, height: H,
      rotation: 0, opacity: 0.05,
      visible: true, locked: false, zIndex: 2,
    },

    // L4 — geometricShape: large accent circle overlapping the clip boundary
    // Bleeds left into flat-color zone, anchoring the two halves
    {
      id: uuidv4(),
      type: "geometricShape",
      label: "Circle Accent",
      x: Math.round(clipX - 60 * s),
      y: Math.round(H * 0.18),
      width: Math.round(120 * s),
      height: Math.round(120 * s),
      rotation: 0, opacity: 1,
      visible: true, locked: false, zIndex: 3,
      shapeData: {
        shapeType: "circle",
        fill: "none",
        stroke: "#c8a96e",
        strokeWidth: Math.round(1.5 * s),
      } satisfies ShapeLayerData,
    },

    // L5 — accentLine: thin horizontal rule at the circle's equator
    {
      id: uuidv4(),
      type: "accentLine",
      label: "Accent Line",
      x: Math.round(40 * s),
      y: Math.round(H * 0.18 + 60 * s),
      width: Math.round((W - 80) * s),
      height: 1,
      rotation: 0, opacity: 1,
      visible: true, locked: false, zIndex: 4,
      shapeData: {
        shapeType: "line",
        fill: "none",
        stroke: "rgba(200,169,110,0.35)",
        strokeWidth: 1,
      } satisfies ShapeLayerData,
    },

    // L6 — metaText: vertical left edge
    {
      id: uuidv4(),
      type: "metaText",
      label: "Festival Meta",
      x: Math.round(14 * s),
      y: Math.round(H * 0.62),
      width: Math.round(180 * s),
      height: Math.round(20 * s),
      rotation: -90, opacity: 1,
      visible: true, locked: false, zIndex: 5,
      textData: {
        text: "FESTIVAL DE CANNES · 2026",
        fontSize: Math.round(10 * s),
        fontFamily: "Space Mono",
        fontStyle: "normal",
        fontWeight: 400,
        fill: "#6a5f4a",
        align: "left",
        letterSpacing: 4,
        lineHeight: 1.2,
        writingMode: "horizontal",
      },
    },

    // L7 — subtitleText: in the flat-color zone, top-left quadrant
    {
      id: uuidv4(),
      type: "subtitleText",
      label: "Subtitle",
      x: Math.round(40 * s),
      y: Math.round(H * 0.28),
      width: Math.round(W * 0.42),
      height: Math.round(40 * s),
      rotation: 0, opacity: 1,
      visible: true, locked: false, zIndex: 6,
      textData: {
        text: "Une œuvre de luminosité",
        fontSize: Math.round(18 * s),
        fontFamily: "Cormorant Garamond",
        fontStyle: "italic",
        fontWeight: 300,
        fill: "#b8a880",
        align: "left",
        letterSpacing: 0.5,
        lineHeight: 1.4,
      },
    },

    // L8 — titleText: bottom-left of flat zone, large and dominant
    {
      id: uuidv4(),
      type: "titleText",
      label: "Title",
      x: Math.round(40 * s),
      y: Math.round(H * 0.62),
      width: Math.round(W * 0.44),
      height: Math.round(210 * s),
      rotation: 0, opacity: 1,
      visible: true, locked: false, zIndex: 7,
      textData: {
        text: "LA\nDERNIÈRE\nLUMIÈRE",
        fontSize: Math.round(76 * s),
        fontFamily: "Anton",
        fontStyle: "normal",
        fontWeight: 400,
        fill: "#ffffff",
        align: "left",
        letterSpacing: 2,
        lineHeight: 0.9,
        textTransform: "uppercase",
      },
    },
  ];

  return {
    layers,
    imagePrompt: "Vast empty cinema auditorium. Velvet red seats receding into darkness. Single beam of projection light cutting through dust-filled air. Deep shadows, golden highlights. No faces, no people, no text. Pure atmosphere.",
    fluxPrompt: "Vast empty cinema auditorium interior, velvet red seats receding into deep darkness, single beam of warm projection light cutting through dust-filled air, golden highlights, extreme depth of field, cinematic composition, noir atmosphere. Woodblock print abstraction. Bold graphic silhouettes. No faces, no people, no text, no letters, no typography.",
    designNotes: "Demo layout — add API keys to generate custom designs.",
    designRationale: "A flat navy field gives typography a clean stage; photography is contained in the right column and subordinate to geometry. A gold circle bridges the two zones, echoing the accent palette.",
    fonts: { display: "Anton", body: "Cormorant Garamond" },
    palette: { dominant: "#0f0f1a", secondary: "#c8a96e", accent: "#ffffff", background: "#0f0f1a" },
  };
}
