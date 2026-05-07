// Gradient presets (ported from font-generator)
// colorStops: [position 0–1, hex, position, hex, ...]
export interface GradientPreset {
  id: string;
  label: string;
  colorStops: (number | string)[];
  angle: number; // degrees — used to compute Konva start/end points
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  { id: "none",   label: "None",   colorStops: [], angle: 135 },
  { id: "flame",  label: "Flame",  colorStops: [0, "#ff6b35", 0.5, "#f7c59f", 1, "#ffd700"], angle: 135 },
  { id: "neon",   label: "Neon",   colorStops: [0, "#ff006e", 1, "#8b00ff"],                  angle: 135 },
  { id: "ocean",  label: "Ocean",  colorStops: [0, "#00d2ff", 1, "#003973"],                  angle: 135 },
  { id: "aurora", label: "Aurora", colorStops: [0, "#00ffcc", 1, "#ff6b9d"],                  angle: 135 },
  { id: "sunset", label: "Sunset", colorStops: [0, "#ff6b9d", 0.5, "#c44dff", 1, "#ff8c00"], angle: 135 },
  { id: "gold",   label: "Gold",   colorStops: [0, "#ffd700", 1, "#ff8c00"],                  angle: 135 },
  { id: "ice",    label: "Ice",    colorStops: [0, "#c9d6ff", 1, "#e2e2e2"],                  angle: 135 },
  { id: "forest", label: "Forest", colorStops: [0, "#1a472a", 1, "#40b87c"],                  angle: 135 },
  { id: "chrome", label: "Chrome", colorStops: [0, "#bdbdbd", 0.5, "#ffffff", 1, "#757575"],  angle: 135 },
];

export function getGradientPreset(id: string): GradientPreset | undefined {
  return GRADIENT_PRESETS.find((g) => g.id === id);
}

// Compute Konva gradient start/end points for a given angle and bounding box
export function gradientPoints(
  angle: number,
  width: number,
  height: number,
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  // Convert CSS gradient angle to a direction vector
  // CSS 0deg = bottom→top, 90deg = left→right, 135deg = top-left→bottom-right
  const rad = ((angle - 90) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Half extents
  const hw = width / 2;
  const hh = height / 2;
  return {
    start: { x: hw - cos * hw, y: hh - sin * hh },
    end:   { x: hw + cos * hw, y: hh + sin * hh },
  };
}

// Decorative effects that map to Konva text properties
export interface EffectDef {
  id: string;
  label: string;
  konvaSupported: boolean; // false = shown in UI but silently ignored on canvas
}

export const EFFECTS: EffectDef[] = [
  { id: "underline",    label: "Underline",    konvaSupported: true  },
  { id: "strikethrough",label: "Strikethrough",konvaSupported: true  },
  { id: "overline",     label: "Overline",     konvaSupported: false }, // Canvas2D doesn't expose overline
  { id: "shadow",       label: "Shadow",       konvaSupported: true  },
  { id: "outline",      label: "Outline",      konvaSupported: true  },
  { id: "neon",         label: "Neon",         konvaSupported: true  }, // approximated via large shadowBlur
  { id: "long-shadow",  label: "Long Shadow",  konvaSupported: false },
  { id: "3d-extrude",   label: "3D Extrude",   konvaSupported: false },
  { id: "letterpress",  label: "Letterpress",  konvaSupported: false },
  { id: "glitch",       label: "Glitch",       konvaSupported: false }, // animation only
];

// 12 preset text color swatches (from font-generator)
export const COLOR_SWATCHES = [
  "#f8f8f8", "#0a0a0c", "#ff006e", "#e5534b",
  "#ff7c00", "#ffd700", "#00f090", "#00b4d8",
  "#7c3aed", "#d946ef", "#f8e8d0", "#1a1a2e",
];
