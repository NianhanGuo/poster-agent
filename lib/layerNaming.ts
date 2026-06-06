/**
 * Deterministic layer naming.
 *
 * Converts whatever label GPT-4o produced (emojis, single characters, icons,
 * gibberish) into a clean, human-readable name that is stable across
 * regenerations — the same layer type always gets the same canonical name.
 *
 * Usage:
 *   import { normalizeLayerNames } from "@/lib/layerNaming";
 *   const namedLayers = normalizeLayerNames(rawLayers);
 *
 * Call this on the freshly generated layers BEFORE merging with locked layers.
 * Locked layers are never passed through this function, so user-renamed locked
 * layers are always preserved as-is.
 */

import type { PosterLayer, LayerType } from "@/types/poster";

// ─── Base names ───────────────────────────────────────────────────────────────

const BASE_NAME: Record<LayerType, string> = {
  // Text
  titleText:        "Title",
  subtitleText:     "Subtitle",
  bodyText:         "Body Text",
  metaText:         "Metadata",
  userText:         "Text",
  // Images
  backgroundImage:  "Main Image",
  subjectImage:     "Cutout Subject",
  userImage:        "Secondary Image",
  foregroundCutout: "Cutout Subject",
  // Shapes
  geometricShape:   "Shape",
  accentLine:       "Accent Line",
  // Backgrounds / overlays
  solidBackground:  "Background",
  noiseTexture:     "Grain",
  textureLayer:     "Texture",
  gradientLayer:    "Gradient",
  colorOverlay:     "Overlay",
  // Other
  drawingLayer:     "Drawing",
  logoPlaceholder:  "Logo",
};

// ─── Numbering rules ──────────────────────────────────────────────────────────

/**
 * Types that always get a numeric suffix, even when only one instance exists.
 * "Shape 01" (not "Shape"), "Cutout Subject 01" (not "Cutout Subject"), etc.
 */
const ALWAYS_NUMBERED = new Set<LayerType>([
  "geometricShape",
  "accentLine",
  "subjectImage",
  "foregroundCutout",
  "subtitleText",
  "bodyText",
  "metaText",
  "userText",
  "userImage",
  "gradientLayer",
  "drawingLayer",
]);

/**
 * Shared counter namespace: subjectImage and foregroundCutout both draw from
 * the "Cutout Subject" counter so their numbers run together.
 */
function namespaceKey(type: LayerType): string {
  if (type === "subjectImage" || type === "foregroundCutout") return "__cutout__";
  return type;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Assigns deterministic, human-readable labels to every layer in the array.
 *
 * Behaviour:
 * - Layers are numbered in ascending zIndex order so the lowest layer of each
 *   type gets "01" — this makes numbering stable across runs.
 * - Types in ALWAYS_NUMBERED always get a " 01" / " 02" suffix.
 * - Other types only get a suffix when multiple layers share the same type.
 * - The output array preserves the original element order (only labels change).
 * - Object references are preserved when the label does not change.
 *
 * @param layers  Freshly generated layers (do NOT pass locked layers here).
 */
export function normalizeLayerNames(layers: PosterLayer[]): PosterLayer[] {
  if (layers.length === 0) return layers;

  // Sort a scratch copy by zIndex so that the lowest-z layer of each type
  // consistently receives the lowest number.
  const byZ = [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  // Count instances per namespace
  const nsCount = new Map<string, number>();
  for (const l of byZ) {
    const k = namespaceKey(l.type);
    nsCount.set(k, (nsCount.get(k) ?? 0) + 1);
  }

  // Assign canonical names in zIndex order
  const nsIndex  = new Map<string, number>();
  const canonical = new Map<string, string>(); // layerId → name

  for (const l of byZ) {
    const base    = BASE_NAME[l.type] ?? l.type;
    const ns      = namespaceKey(l.type);
    const count   = nsCount.get(ns) ?? 1;
    const alwaysN = ALWAYS_NUMBERED.has(l.type);
    const idx     = (nsIndex.get(ns) ?? 0) + 1;
    nsIndex.set(ns, idx);

    canonical.set(
      l.id,
      alwaysN || count > 1 ? `${base} ${pad2(idx)}` : base,
    );
  }

  // Apply — preserve object reference when nothing changes
  return layers.map((l) => {
    const name = canonical.get(l.id) ?? l.label;
    return name === l.label ? l : { ...l, label: name };
  });
}
