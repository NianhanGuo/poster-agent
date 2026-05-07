"use client";
import { usePosterStore } from "@/store/posterStore";
import type { Layer } from "@/types/poster";

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
    toggleLock,
    toggleVisibility,
    removeLayer,
    duplicateLayer,
    moveLayerUp,
    moveLayerDown,
  } = usePosterStore();

  if (!project) return null;

  const layers = [...getSortedLayers()].reverse();

  return (
    <div className="py-3">
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
  );
}

function LayerRow({
  layer, selected, onSelect, onToggleLock, onToggleVisibility,
  onDelete, onDuplicate, onMoveUp, onMoveDown,
}: {
  layer: Layer;
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
