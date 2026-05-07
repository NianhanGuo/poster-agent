"use client";
import { useState } from "react";
import { usePosterStore } from "@/store/posterStore";
import { ImageUploadPanel } from "./ImageUploadPanel";
import type { PosterLayer } from "@/types/poster";
import { isTextLayer, isImageLayer } from "@/types/poster";

const FONT_FAMILIES = [
  "Arial", "Helvetica Neue", "Georgia", "Times New Roman",
  "Courier New", "Impact", "Palatino", "Garamond", "Baskerville",
];

export function ToolPanel() {
  const { project, selectedLayerId, getLayerById, updateLayer, updateTextData, addLayer } =
    usePosterStore();
  const [showImageUpload, setShowImageUpload] = useState(false);

  if (!project) return null;

  const selected = selectedLayerId ? getLayerById(selectedLayerId) : null;
  const textSelected = selected ? isTextLayer(selected.type) : false;
  const imageSelected = selected ? isImageLayer(selected.type) : false;

  function addTextLayer() {
    const canvas = project!.canvas;
    const newLayer: PosterLayer = {
      id: crypto.randomUUID(),
      type: "userText",
      label: "Text",
      x: Math.round(canvas.width * 0.1),
      y: Math.round(canvas.height * 0.5),
      width: Math.round(canvas.width * 0.8),
      height: 120,
      rotation: 0, opacity: 1, visible: true, locked: false, zIndex: 10,
      textData: {
        text: "New Text",
        fontSize: 64,
        fontFamily: "Helvetica Neue",
        fontStyle: "normal",
        fill: "#ffffff",
        align: "center",
        letterSpacing: 2,
        lineHeight: 1.2,
      },
    };
    addLayer(newLayer);
  }

  return (
    <div className="py-3 space-y-5 text-xs">
      {/* Add */}
      <div className="px-4 space-y-2">
        <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-700 pb-1">
          Add
        </div>
        <div className="flex gap-2">
          <button
            onClick={addTextLayer}
            className="flex-1 border border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-zinc-300 font-mono text-[10px] tracking-wide uppercase py-1.5 transition-colors"
          >
            + Text
          </button>
          <button
            onClick={() => setShowImageUpload(!showImageUpload)}
            className="flex-1 border border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-zinc-300 font-mono text-[10px] tracking-wide uppercase py-1.5 transition-colors"
          >
            + Image
          </button>
        </div>
        {showImageUpload && (
          <ImageUploadPanel onClose={() => setShowImageUpload(false)} />
        )}
      </div>

      {!selected && (
        <div className="px-4 font-mono text-[10px] text-zinc-700">
          select a layer
        </div>
      )}

      {selected && textSelected && selected.textData && (
        <TextProps
          layer={selected}
          onText={(u) => updateTextData(selected.id, u)}
          onLayer={(u) => updateLayer(selected.id, u)}
        />
      )}

      {selected && imageSelected && (
        <ImageProps
          layer={selected}
          onLayer={(u) => updateLayer(selected.id, u)}
        />
      )}

      {selected && (
        <TransformProps
          layer={selected}
          onLayer={(u) => updateLayer(selected.id, u)}
        />
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 py-0.5">
      <span className="font-mono text-[9px] tracking-wide uppercase text-zinc-700 w-16 flex-none">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder = "" }: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-transparent border-b border-zinc-800 focus:border-zinc-600 text-zinc-300 font-mono text-[10px] outline-none pb-0.5 placeholder:text-zinc-700 transition-colors"
    />
  );
}

function Section({ label }: { label: string }) {
  return (
    <div className="px-4 pt-3 pb-1 font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-700 border-t border-zinc-900">
      {label}
    </div>
  );
}

function TextProps({
  layer, onText, onLayer,
}: {
  layer: PosterLayer;
  onText: (u: Partial<NonNullable<PosterLayer["textData"]>>) => void;
  onLayer: (u: Partial<PosterLayer>) => void;
}) {
  const td = layer.textData!;
  return (
    <>
      <Section label="Text" />
      <div className="px-4">
        <textarea
          value={td.text}
          onChange={(e) => onText({ text: e.target.value })}
          rows={3}
          className="w-full bg-transparent border-b border-zinc-800 focus:border-zinc-600 text-zinc-300 font-mono text-[10px] outline-none pb-1 resize-none placeholder:text-zinc-700 transition-colors"
        />
      </div>

      <Row label="Font">
        <select
          value={td.fontFamily}
          onChange={(e) => onText({ fontFamily: e.target.value })}
          className="w-full bg-transparent text-zinc-300 font-mono text-[10px] outline-none border-b border-zinc-800 pb-0.5"
        >
          {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </Row>

      <Row label="Size">
        <div className="flex items-center gap-2">
          <input
            type="range" min={8} max={400}
            value={td.fontSize}
            onChange={(e) => onText({ fontSize: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="font-mono text-[10px] text-zinc-500 w-8 text-right">{td.fontSize}</span>
        </div>
      </Row>

      <Row label="Style">
        <div className="flex gap-1">
          {(["normal", "bold", "italic"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onText({ fontStyle: s })}
              className={`px-2 py-0.5 font-mono text-[9px] border transition-colors ${
                td.fontStyle === s
                  ? "border-zinc-500 text-zinc-200"
                  : "border-zinc-800 text-zinc-600 hover:border-zinc-600"
              }`}
            >
              {s[0].toUpperCase()}
            </button>
          ))}
        </div>
      </Row>

      <Row label="Align">
        <div className="flex gap-1">
          {(["left", "center", "right"] as const).map((a) => (
            <button
              key={a}
              onClick={() => onText({ align: a })}
              className={`px-2 py-0.5 font-mono text-[9px] border transition-colors ${
                td.align === a
                  ? "border-zinc-500 text-zinc-200"
                  : "border-zinc-800 text-zinc-600 hover:border-zinc-600"
              }`}
            >
              {a === "left" ? "L" : a === "center" ? "C" : "R"}
            </button>
          ))}
        </div>
      </Row>

      <Row label="Color">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={td.fill}
            onChange={(e) => onText({ fill: e.target.value })}
            className="w-5 h-5 bg-transparent border-0 cursor-pointer"
          />
          <input
            type="text"
            value={td.fill}
            onChange={(e) => onText({ fill: e.target.value })}
            className="flex-1 bg-transparent border-b border-zinc-800 text-zinc-300 font-mono text-[10px] outline-none pb-0.5"
          />
        </div>
      </Row>

      <Row label="Tracking">
        <div className="flex items-center gap-2">
          <input
            type="range" min={-5} max={40}
            value={td.letterSpacing ?? 0}
            onChange={(e) => onText({ letterSpacing: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="font-mono text-[10px] text-zinc-500 w-6 text-right">{td.letterSpacing ?? 0}</span>
        </div>
      </Row>

      <Row label="Width">
        <div className="flex items-center gap-2">
          <input
            type="range" min={50} max={Math.max(layer.width, 2000)}
            value={layer.width}
            onChange={(e) => onLayer({ width: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="font-mono text-[10px] text-zinc-500 w-10 text-right">{layer.width}px</span>
        </div>
      </Row>
    </>
  );
}

function ImageProps({ layer, onLayer }: {
  layer: PosterLayer;
  onLayer: (u: Partial<PosterLayer>) => void;
}) {
  return (
    <>
      <Section label="Image" />
      <Row label="Src">
        <Input
          value={layer.imageData?.src ?? ""}
          onChange={(v) => onLayer({ imageData: { ...(layer.imageData ?? {}), src: v } })}
          placeholder="https://… or data:image/…"
        />
      </Row>
    </>
  );
}

function TransformProps({ layer, onLayer }: {
  layer: PosterLayer;
  onLayer: (u: Partial<PosterLayer>) => void;
}) {
  return (
    <>
      <Section label="Transform" />
      <div className="px-4 grid grid-cols-2 gap-x-3 gap-y-2">
        {[
          { label: "X", value: Math.round(layer.x), key: "x" },
          { label: "Y", value: Math.round(layer.y), key: "y" },
          { label: "W", value: Math.round(layer.width), key: "width" },
          { label: "H", value: Math.round(layer.height), key: "height" },
        ].map(({ label, value, key }) => (
          <div key={key}>
            <span className="font-mono text-[9px] tracking-wide uppercase text-zinc-700">{label}</span>
            <input
              type="number"
              value={value}
              onChange={(e) => onLayer({ [key]: Number(e.target.value) })}
              className="block w-full bg-transparent border-b border-zinc-800 text-zinc-300 font-mono text-[10px] outline-none pb-0.5 mt-0.5"
            />
          </div>
        ))}
      </div>

      <Row label="Rotate">
        <div className="flex items-center gap-2">
          <input
            type="range" min={-180} max={180}
            value={layer.rotation}
            onChange={(e) => onLayer({ rotation: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="font-mono text-[10px] text-zinc-500 w-8 text-right">{Math.round(layer.rotation)}°</span>
        </div>
      </Row>

      <Row label="Opacity">
        <div className="flex items-center gap-2">
          <input
            type="range" min={0} max={1} step={0.01}
            value={layer.opacity}
            onChange={(e) => onLayer({ opacity: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="font-mono text-[10px] text-zinc-500 w-8 text-right">{Math.round(layer.opacity * 100)}%</span>
        </div>
      </Row>

      <Row label="Z">
        <Input
          type="number"
          value={layer.zIndex}
          onChange={(v) => onLayer({ zIndex: Number(v) })}
        />
      </Row>
    </>
  );
}
