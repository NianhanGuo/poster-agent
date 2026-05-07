"use client";
import { useRef } from "react";
import { usePosterStore } from "@/store/posterStore";
import type { PosterLayer } from "@/types/poster";

const TYPE_LABEL: Record<string, string> = {
  backgroundImage: "bg",
  subjectImage:    "subject",
  titleText:       "title",
  subtitleText:    "subtitle",
  metaText:        "meta",
  bodyText:        "body",
  foregroundCutout:"cutout",
  userText:        "text",
  userImage:       "image",
};

export function LayerPanel() {
  const {
    project,
    selectedLayerId,
    selectLayer,
    getSortedLayers,
    addLayer,
    toggleLock,
    toggleVisibility,
    removeLayer,
    duplicateLayer,
    moveLayerUp,
    moveLayerDown,
    setBrushActive,
  } = usePosterStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!project) return null;

  const layers = [...getSortedLayers()].reverse();
  const canvas = project.canvas;

  function addTextLayer() {
    const newLayer: PosterLayer = {
      id: crypto.randomUUID(),
      type: "userText",
      label: "Text",
      x: Math.round(canvas.width * 0.1),
      y: Math.round(canvas.height * 0.45),
      width: Math.round(canvas.width * 0.8),
      height: 120,
      rotation: 0, opacity: 1, visible: true, locked: false, zIndex: 0,
      textData: {
        text: "New Text",
        fontSize: 64,
        fontFamily: "Inter",
        fontStyle: "normal",
        fontWeight: 400,
        italic: false,
        fill: "#ffffff",
        align: "center",
        letterSpacing: 2,
        lineHeight: 1.2,
      },
    };
    addLayer(newLayer);
  }

  function addDrawingLayer() {
    const existing = getSortedLayers().find((l) => l.type === "drawingLayer");
    if (!existing) {
      const newLayer: PosterLayer = {
        id: crypto.randomUUID(),
        type: "drawingLayer",
        label: "Drawing",
        x: 0, y: 0,
        width: canvas.width, height: canvas.height,
        rotation: 0, opacity: 1, visible: true, locked: false, zIndex: 0,
        imageData: { src: "", fit: "fill" },
      };
      addLayer(newLayer);
    }
    setBrushActive(true);
  }

  function handleImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) return;
      const userImgCount = getSortedLayers().filter((l) => l.type === "userImage").length;
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const newLayer: PosterLayer = {
        id: crypto.randomUUID(),
        type: "userImage",
        label: baseName || `image ${userImgCount + 1}`,
        x: Math.round(canvas.width * 0.05),
        y: Math.round(canvas.height * 0.05),
        width: Math.round(canvas.width * 0.9),
        height: Math.round(canvas.height * 0.9),
        rotation: 0, opacity: 1, visible: true, locked: false, zIndex: 0,
        imageData: { src, fit: "contain" },
      };
      addLayer(newLayer);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 py-3 overflow-y-auto">
        <div className="px-4 pb-2 font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-700">
          Layers
        </div>

        {layers.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            selected={selectedLayerId === layer.id}
            onSelect={() => selectLayer(layer.id)}
            onToggleLock={() => toggleLock(layer.id)}
            onToggleVisibility={() => toggleVisibility(layer.id)}
            onDelete={() => removeLayer(layer.id)}
            onDuplicate={() => duplicateLayer(layer.id)}
            onMoveUp={() => moveLayerUp(layer.id)}
            onMoveDown={() => moveLayerDown(layer.id)}
          />
        ))}
      </div>

      {/* Add layer footer */}
      <div
        className="flex-none px-3 py-2 space-y-1.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="font-mono text-[8px] tracking-[0.2em] uppercase text-zinc-800">Add</div>
        <div className="flex gap-1">
          <AddBtn onClick={addTextLayer} title="Add text layer">T</AddBtn>
          <AddBtn
            onClick={() => fileInputRef.current?.click()}
            title="Add image layer"
          >⬡</AddBtn>
          <AddBtn onClick={addDrawingLayer} title="Add drawing layer (activates brush)">✏</AddBtn>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImageFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function LayerRow({
  layer, selected, onSelect, onToggleLock, onToggleVisibility,
  onDelete, onDuplicate, onMoveUp, onMoveDown,
}: {
  layer: PosterLayer;
  selected: boolean;
  onSelect: () => void;
  onToggleLock: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`group flex items-center gap-2 px-4 py-1.5 cursor-pointer transition-colors ${
        selected ? "bg-zinc-900 text-zinc-200" : "hover:bg-zinc-950 text-zinc-500"
      } ${!layer.visible ? "opacity-30" : ""}`}
    >
      {/* Type badge */}
      <span className={`font-mono text-[9px] tracking-wide w-12 flex-none ${selected ? "text-zinc-500" : "text-zinc-700"}`}>
        {TYPE_LABEL[layer.type] ?? layer.type}
      </span>

      {/* Label */}
      <span className="font-mono text-[10px] truncate flex-1 min-w-0">
        {layer.label}
      </span>

      {/* Persistent lock indicator */}
      {layer.locked && (
        <span className="font-mono text-[9px] text-zinc-600 flex-none group-hover:hidden" title="locked">■</span>
      )}

      {/* Controls */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Btn title={layer.visible ? "hide" : "show"} onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}>
          {layer.visible ? "○" : "◌"}
        </Btn>
        <Btn title={layer.locked ? "unlock" : "lock"} onClick={(e) => { e.stopPropagation(); onToggleLock(); }}>
          {layer.locked ? "■" : "□"}
        </Btn>
        <Btn title="up" onClick={(e) => { e.stopPropagation(); onMoveUp(); }}>↑</Btn>
        <Btn title="down" onClick={(e) => { e.stopPropagation(); onMoveDown(); }}>↓</Btn>
        <Btn title="dupe" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>+</Btn>
        <button
          title="Merge coming soon"
          disabled
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 flex items-center justify-center font-mono text-[10px] text-zinc-800 cursor-not-allowed"
        >⊕</button>
        <Btn title="delete" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${layer.label}"?`)) onDelete(); }} className="hover:text-red-500">×</Btn>
      </div>
    </div>
  );
}

function Btn({ children, onClick, title, className = "" }: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  title: string;
  className?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`w-4 h-4 flex items-center justify-center font-mono text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

function AddBtn({ children, onClick, title }: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex-1 py-1.5 font-mono text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors border border-zinc-900 hover:border-zinc-700 rounded-sm"
    >
      {children}
    </button>
  );
}
