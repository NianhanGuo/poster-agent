"use client";
import { usePosterStore } from "@/store/posterStore";
import type { Layer } from "@/types/poster";

const LAYER_TYPE_ICONS: Record<string, string> = {
  "background-image": "🖼",
  "title-text": "T",
  "subtitle-text": "t",
  "date-location-text": "📅",
  "credits-text": "ℹ",
  "foreground-cutout": "✂",
  "user-text": "A",
  "user-image": "🖼",
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

  // Reverse sorted so highest zIndex shows at top
  const layers = [...getSortedLayers()].reverse();

  return (
    <div className="p-2 space-y-1">
      <div className="px-2 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
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
  layer,
  selected,
  onSelect,
  onToggleLock,
  onToggleVisibility,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
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
      className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
        selected
          ? "bg-violet-600/20 border border-violet-600/40"
          : "hover:bg-zinc-800 border border-transparent"
      } ${!layer.visible ? "opacity-40" : ""}`}
    >
      {/* Icon */}
      <span className="text-sm w-5 text-center flex-none">
        {LAYER_TYPE_ICONS[layer.type] ?? "◻"}
      </span>

      {/* Label */}
      <span className="text-xs text-zinc-300 truncate flex-1 min-w-0">
        {layer.label}
      </span>

      {/* Controls — shown on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <IconButton
          title={layer.visible ? "Hide" : "Show"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility();
          }}
        >
          {layer.visible ? "👁" : "🙈"}
        </IconButton>
        <IconButton
          title={layer.locked ? "Unlock" : "Lock"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock();
          }}
        >
          {layer.locked ? "🔒" : "🔓"}
        </IconButton>
        <IconButton
          title="Move up"
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
        >
          ↑
        </IconButton>
        <IconButton
          title="Move down"
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
        >
          ↓
        </IconButton>
        <IconButton
          title="Duplicate"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
        >
          ⧉
        </IconButton>
        <IconButton
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete "${layer.label}"?`)) onDelete();
          }}
          className="hover:text-red-400"
        >
          ✕
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  title,
  className = "",
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  title: string;
  className?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`w-5 h-5 flex items-center justify-center text-xs text-zinc-500 hover:text-zinc-200 rounded transition-colors ${className}`}
    >
      {children}
    </button>
  );
}
