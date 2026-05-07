"use client";
import { useState } from "react";
import { usePosterStore } from "@/store/posterStore";
import { ImageUploadPanel } from "./ImageUploadPanel";
import type { Layer } from "@/types/poster";

const FONT_FAMILIES = [
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Impact",
  "Trebuchet MS",
  "Verdana",
  "Palatino",
  "Garamond",
  "Futura",
  "Gill Sans",
  "Baskerville",
];

export function ToolPanel() {
  const { project, selectedLayerId, getLayerById, updateLayer, updateTextData, addLayer } =
    usePosterStore();
  const [showAddText, setShowAddText] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);

  if (!project) return null;

  const selected = selectedLayerId ? getLayerById(selectedLayerId) : null;
  const isText = selected?.type.includes("text");
  const isImage =
    selected?.type === "background-image" ||
    selected?.type === "foreground-cutout" ||
    selected?.type === "user-image";

  function addTextLayer() {
    const canvas = project!.canvas;
    const newLayer: Layer = {
      id: crypto.randomUUID(),
      type: "user-text",
      label: "Text",
      x: canvas.width / 2 - 150,
      y: canvas.height / 2 - 30,
      width: 300,
      height: 60,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 10,
      textData: {
        text: "New Text",
        fontSize: 48,
        fontFamily: "Helvetica",
        fontStyle: "bold",
        fill: "#ffffff",
        align: "center",
        letterSpacing: 2,
        lineHeight: 1.2,
      },
    };
    addLayer(newLayer);
    setShowAddText(false);
  }

  return (
    <div className="p-3 space-y-4 text-sm">
      {/* Add layers */}
      <div>
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          Add
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={addTextLayer}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg py-2 text-xs transition-colors"
          >
            + Text
          </button>
          <button
            onClick={() => setShowImageUpload(!showImageUpload)}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg py-2 text-xs transition-colors"
          >
            + Image
          </button>
        </div>
      </div>

      {showImageUpload && (
        <ImageUploadPanel onClose={() => setShowImageUpload(false)} />
      )}

      {/* No selection */}
      {!selected && (
        <div className="text-xs text-zinc-600 text-center py-4">
          Select a layer to edit its properties
        </div>
      )}

      {/* Text properties */}
      {selected && isText && selected.textData && (
        <TextProperties
          layer={selected}
          onUpdateText={(updates) => updateTextData(selected.id, updates)}
          onUpdateLayer={(updates) => updateLayer(selected.id, updates)}
        />
      )}

      {/* Image properties */}
      {selected && isImage && (
        <ImageProperties
          layer={selected}
          onUpdateLayer={(updates) => updateLayer(selected.id, updates)}
        />
      )}

      {/* Common properties */}
      {selected && (
        <CommonProperties
          layer={selected}
          onUpdateLayer={(updates) => updateLayer(selected.id, updates)}
        />
      )}
    </div>
  );
}

function TextProperties({
  layer,
  onUpdateText,
  onUpdateLayer,
}: {
  layer: Layer;
  onUpdateText: (u: Partial<NonNullable<Layer["textData"]>>) => void;
  onUpdateLayer: (u: Partial<Layer>) => void;
}) {
  const td = layer.textData!;

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
        Text
      </div>

      {/* Text content */}
      <div>
        <label className="text-xs text-zinc-400">Content</label>
        <textarea
          value={td.text}
          onChange={(e) => onUpdateText({ text: e.target.value })}
          className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs resize-none h-16 focus:outline-none focus:border-violet-500"
        />
      </div>

      {/* Font family */}
      <div>
        <label className="text-xs text-zinc-400">Font</label>
        <select
          value={td.fontFamily}
          onChange={(e) => onUpdateText({ fontFamily: e.target.value })}
          className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {/* Font size */}
      <div>
        <label className="text-xs text-zinc-400">
          Size: {td.fontSize}px
        </label>
        <input
          type="range"
          min={8}
          max={300}
          value={td.fontSize}
          onChange={(e) => onUpdateText({ fontSize: Number(e.target.value) })}
          className="w-full mt-1 accent-violet-500"
        />
      </div>

      {/* Font style */}
      <div>
        <label className="text-xs text-zinc-400">Style</label>
        <div className="flex gap-1 mt-1">
          {(["normal", "bold", "italic", "bold italic"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onUpdateText({ fontStyle: s })}
              className={`flex-1 py-1 rounded text-xs border transition-colors ${
                td.fontStyle === s
                  ? "border-violet-500 text-violet-300 bg-violet-500/10"
                  : "border-zinc-700 text-zinc-500 hover:border-zinc-600"
              }`}
            >
              {s === "normal" ? "N" : s === "bold" ? "B" : s === "italic" ? "I" : "BI"}
            </button>
          ))}
        </div>
      </div>

      {/* Align */}
      <div>
        <label className="text-xs text-zinc-400">Align</label>
        <div className="flex gap-1 mt-1">
          {(["left", "center", "right"] as const).map((a) => (
            <button
              key={a}
              onClick={() => onUpdateText({ align: a })}
              className={`flex-1 py-1 rounded text-xs border transition-colors ${
                td.align === a
                  ? "border-violet-500 text-violet-300 bg-violet-500/10"
                  : "border-zinc-700 text-zinc-500 hover:border-zinc-600"
              }`}
            >
              {a === "left" ? "⬅" : a === "center" ? "⬛" : "➡"}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div>
        <label className="text-xs text-zinc-400">Color</label>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={td.fill}
            onChange={(e) => onUpdateText({ fill: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
          />
          <input
            type="text"
            value={td.fill}
            onChange={(e) => onUpdateText({ fill: e.target.value })}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white font-mono"
          />
        </div>
      </div>

      {/* Letter spacing */}
      <div>
        <label className="text-xs text-zinc-400">
          Letter spacing: {td.letterSpacing ?? 0}
        </label>
        <input
          type="range"
          min={-5}
          max={30}
          value={td.letterSpacing ?? 0}
          onChange={(e) =>
            onUpdateText({ letterSpacing: Number(e.target.value) })
          }
          className="w-full mt-1 accent-violet-500"
        />
      </div>

      {/* Width */}
      <div>
        <label className="text-xs text-zinc-400">Width: {layer.width}px</label>
        <input
          type="range"
          min={50}
          max={layer.width ? Math.max(layer.width, 2000) : 2000}
          value={layer.width}
          onChange={(e) => onUpdateLayer({ width: Number(e.target.value) })}
          className="w-full mt-1 accent-violet-500"
        />
      </div>
    </div>
  );
}

function ImageProperties({
  layer,
  onUpdateLayer,
}: {
  layer: Layer;
  onUpdateLayer: (u: Partial<Layer>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
        Image
      </div>
      <div>
        <label className="text-xs text-zinc-400">Image URL</label>
        <input
          type="text"
          value={layer.imageData?.src ?? ""}
          onChange={(e) =>
            onUpdateLayer({
              imageData: { ...(layer.imageData ?? {}), src: e.target.value },
            })
          }
          placeholder="https://... or /uploads/..."
          className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500 placeholder:text-zinc-600"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-400">W: {layer.width}px</label>
          <input
            type="number"
            value={layer.width}
            onChange={(e) => onUpdateLayer({ width: Number(e.target.value) })}
            className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400">H: {layer.height}px</label>
          <input
            type="number"
            value={layer.height}
            onChange={(e) => onUpdateLayer({ height: Number(e.target.value) })}
            className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
          />
        </div>
      </div>
    </div>
  );
}

function CommonProperties({
  layer,
  onUpdateLayer,
}: {
  layer: Layer;
  onUpdateLayer: (u: Partial<Layer>) => void;
}) {
  return (
    <div className="space-y-3 border-t border-zinc-800 pt-3">
      <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
        Transform
      </div>

      {/* Position */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-400">X</label>
          <input
            type="number"
            value={Math.round(layer.x)}
            onChange={(e) => onUpdateLayer({ x: Number(e.target.value) })}
            className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Y</label>
          <input
            type="number"
            value={Math.round(layer.y)}
            onChange={(e) => onUpdateLayer({ y: Number(e.target.value) })}
            className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
          />
        </div>
      </div>

      {/* Rotation */}
      <div>
        <label className="text-xs text-zinc-400">
          Rotation: {Math.round(layer.rotation)}°
        </label>
        <input
          type="range"
          min={-180}
          max={180}
          value={layer.rotation}
          onChange={(e) => onUpdateLayer({ rotation: Number(e.target.value) })}
          className="w-full mt-1 accent-violet-500"
        />
      </div>

      {/* Opacity */}
      <div>
        <label className="text-xs text-zinc-400">
          Opacity: {Math.round(layer.opacity * 100)}%
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={layer.opacity}
          onChange={(e) => onUpdateLayer({ opacity: Number(e.target.value) })}
          className="w-full mt-1 accent-violet-500"
        />
      </div>

      {/* Z-Index */}
      <div>
        <label className="text-xs text-zinc-400">Z-Index: {layer.zIndex}</label>
        <input
          type="number"
          value={layer.zIndex}
          onChange={(e) => onUpdateLayer({ zIndex: Number(e.target.value) })}
          className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
        />
      </div>
    </div>
  );
}
