"use client";
import { useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { usePosterStore } from "@/store/posterStore";
import type { PosterLayer, GradientColorStop } from "@/types/poster";

const TYPE_ICON: Record<string, string> = {
  backgroundImage:  "🖼",
  subjectImage:     "👤",
  titleText:        "T",
  subtitleText:     "T",
  metaText:         "t",
  bodyText:         "¶",
  foregroundCutout: "✂",
  userText:         "T",
  userImage:        "🖼",
  drawingLayer:     "✏",
  gradientLayer:    "◑",
  textureLayer:     "⣿",
  colorOverlay:     "▣",
  geometricShape:   "◻",
  accentLine:       "—",
  solidBackground:  "■",
};

const TYPE_LABEL: Record<string, string> = {
  backgroundImage:  "bg",
  subjectImage:     "subject",
  titleText:        "title",
  subtitleText:     "subtitle",
  metaText:         "meta",
  bodyText:         "body",
  foregroundCutout: "cutout",
  userText:         "text",
  userImage:        "image",
  drawingLayer:     "draw",
  gradientLayer:    "gradient",
  textureLayer:     "grain",
  colorOverlay:     "overlay",
  geometricShape:   "shape",
  accentLine:       "line",
  solidBackground:  "solid",
};

// ─── Grain generator ───────────────────────────────────────────────────────────

function generateGrainDataUrl(width: number, height: number, intensity: number, scale: number): string {
  const s = Math.max(1, Math.round(scale));
  const w = Math.ceil(width / s);
  const h = Math.ceil(height / s);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(w, h);
  const alpha = Math.round((intensity / 100) * 255);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = alpha;
  }
  ctx.putImageData(img, 0, 0);
  if (s === 1) return canvas.toDataURL();
  const canvas2 = document.createElement("canvas");
  canvas2.width = width;
  canvas2.height = height;
  const ctx2 = canvas2.getContext("2d")!;
  ctx2.imageSmoothingEnabled = false;
  ctx2.drawImage(canvas, 0, 0, width, height);
  return canvas2.toDataURL();
}

export function LayerPanel() {
  const {
    project,
    selectedLayerId,
    selectLayer,
    getSortedLayers,
    addLayer,
    reorderLayers,
    pushHistory,
    toggleLock,
    toggleVisibility,
    removeLayer,
    duplicateLayer,
    moveLayerUp,
    moveLayerDown,
    setBrushActive,
  } = usePosterStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!project) return null;

  const layers = [...getSortedLayers()].reverse();
  const layerIds = layers.map((l) => l.id);
  const canvas = project.canvas;
  const activeLayer = activeId ? layers.find((l) => l.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = layers.findIndex((l) => l.id === active.id);
    const newIndex = layers.findIndex((l) => l.id === over.id);
    const newDisplayOrder = arrayMove(layers, oldIndex, newIndex);

    const n = newDisplayOrder.length;
    const reindexed = newDisplayOrder.map((layer, i) => ({
      ...layer,
      zIndex: n - i,
    }));

    pushHistory();
    reorderLayers(reindexed);
  }

  function addGradientLayer() {
    const newLayer: PosterLayer = {
      id: crypto.randomUUID(),
      type: "gradientLayer",
      label: "Gradient",
      x: 0, y: 0,
      width: canvas.width, height: canvas.height,
      rotation: 0, opacity: 0.8, visible: true, locked: false, zIndex: 0,
      blendMode: "normal",
      gradientData: {
        gradientType: "radial",
        stops: [
          { offset: 0, color: "#4a1d96" },
          { offset: 1, color: "rgba(0,0,0,0)" },
        ] as GradientColorStop[],
        angle: 0,
      },
    };
    addLayer(newLayer);
  }

  function addTextureLayer() {
    const intensity = 30;
    const scale = 2;
    const src = generateGrainDataUrl(canvas.width, canvas.height, intensity, scale);
    const newLayer: PosterLayer = {
      id: crypto.randomUUID(),
      type: "textureLayer",
      label: "Grain",
      x: 0, y: 0,
      width: canvas.width, height: canvas.height,
      rotation: 0, opacity: 0.4, visible: true, locked: false, zIndex: 0,
      blendMode: "overlay",
      imageData: { src, fit: "fill" },
      noiseData: { intensity, scale },
    };
    addLayer(newLayer);
  }

  function addAtmosphericPreset() {
    const gradLayer: PosterLayer = {
      id: crypto.randomUUID(),
      type: "gradientLayer",
      label: "Atmosphere",
      x: 0, y: 0,
      width: canvas.width, height: canvas.height,
      rotation: 0, opacity: 0.55, visible: true, locked: false, zIndex: 0,
      blendMode: "soft-light",
      gradientData: {
        gradientType: "radial",
        stops: [
          { offset: 0,   color: "#6b21a8" },
          { offset: 0.5, color: "#1e1b4b" },
          { offset: 1,   color: "rgba(0,0,0,0)" },
        ] as GradientColorStop[],
        angle: 0,
      },
    };
    const grainSrc = generateGrainDataUrl(canvas.width, canvas.height, 22, 1);
    const grainLayer: PosterLayer = {
      id: crypto.randomUUID(),
      type: "textureLayer",
      label: "Film Grain",
      x: 0, y: 0,
      width: canvas.width, height: canvas.height,
      rotation: 0, opacity: 0.28, visible: true, locked: false, zIndex: 0,
      blendMode: "overlay",
      imageData: { src: grainSrc, fit: "fill" },
      noiseData: { intensity: 22, scale: 1 },
    };
    addLayer(gradLayer);
    addLayer(grainLayer);
  }

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
      {/* Section header */}
      <div className="px-3 pt-3 pb-1">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500">
          Layers
        </span>
      </div>

      <div className="flex-1 py-1 overflow-y-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={layerIds} strategy={verticalListSortingStrategy}>
            {layers.map((layer) => (
              <SortableLayerRow
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
          </SortableContext>

          <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
            {activeLayer ? (
              <div className="rounded-md bg-zinc-800 border border-zinc-600/60 shadow-xl">
                <LayerRow
                  layer={activeLayer}
                  selected={false}
                  isDragging
                  onSelect={() => {}}
                  onToggleLock={() => {}}
                  onToggleVisibility={() => {}}
                  onDelete={() => {}}
                  onDuplicate={() => {}}
                  onMoveUp={() => {}}
                  onMoveDown={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Add layer footer */}
      <div className="flex-none px-3 py-3 space-y-2 border-t border-zinc-800/60">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500">Add layer</span>
        <div className="grid grid-cols-5 gap-1">
          <AddBtn onClick={addTextLayer} title="Text layer" label="T" />
          <AddBtn onClick={() => fileInputRef.current?.click()} title="Image" label="🖼" />
          <AddBtn onClick={addDrawingLayer} title="Draw / brush" label="✏" />
          <AddBtn onClick={addGradientLayer} title="Gradient" label="◑" />
          <AddBtn onClick={addTextureLayer} title="Grain / texture" label="⣿" />
        </div>

        <button
          onClick={addAtmosphericPreset}
          className="w-full py-1.5 text-[12px] font-medium text-zinc-500 hover:text-zinc-200 transition-colors rounded-md border border-zinc-800/80 hover:border-zinc-600"
          title="Adds a violet radial gradient + film grain layer stack"
        >
          + Atmospheric preset
        </button>

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

// ─── Sortable wrapper ─────────────────────────────────────────────────────────

type LayerRowProps = {
  layer: PosterLayer;
  selected: boolean;
  isDragging?: boolean;
  dragHandle?: React.ReactNode;
  onSelect: () => void;
  onToggleLock: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

function SortableLayerRow(props: Omit<LayerRowProps, "isDragging" | "dragHandle">) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.layer.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: "relative",
  };

  const handle = (
    <button
      {...attributes}
      {...listeners}
      tabIndex={-1}
      className="flex-none w-4 h-full flex items-center justify-center cursor-grab active:cursor-grabbing select-none text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity hover:text-zinc-400"
      title="Drag to reorder"
      onClick={(e) => e.stopPropagation()}
    >
      ⠿
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <LayerRow {...props} isDragging={isDragging} dragHandle={handle} />
    </div>
  );
}

// ─── Layer row ────────────────────────────────────────────────────────────────

function LayerRow({
  layer, selected, isDragging, dragHandle,
  onSelect, onToggleLock, onToggleVisibility,
  onDelete, onDuplicate, onMoveUp, onMoveDown,
}: LayerRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative px-1.5">
      <div
        onClick={onSelect}
        className={`group flex items-center gap-1.5 h-8 px-1.5 rounded-md cursor-pointer transition-colors ${
          isDragging
            ? "bg-zinc-800 text-zinc-200"
            : selected
            ? "bg-zinc-800 text-zinc-100"
            : "hover:bg-zinc-800/50 text-zinc-400"
        } ${!layer.visible ? "opacity-40" : ""}`}
      >
        {/* Drag handle */}
        {dragHandle ?? <span className="w-4 flex-none" />}

        {/* Type icon */}
        <span className="text-[11px] w-4 flex-none text-center text-zinc-600 group-hover:text-zinc-500">
          {TYPE_ICON[layer.type] ?? "◻"}
        </span>

        {/* Label */}
        <span className="text-[12px] font-medium truncate flex-1 min-w-0">
          {layer.label}
        </span>

        {/* Lock indicator (always visible when locked, hidden on hover) */}
        {layer.locked && !menuOpen && (
          <span className="text-[9px] text-zinc-600 flex-none group-hover:hidden">🔒</span>
        )}

        {/* Hover controls */}
        <div className={`flex items-center gap-0.5 ${menuOpen ? "flex" : "hidden group-hover:flex"}`}>
          {/* Visibility */}
          <button
            title={layer.visible ? "Hide layer" : "Show layer"}
            onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
            className="w-5 h-5 flex items-center justify-center text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors rounded"
          >
            {layer.visible ? "○" : "◌"}
          </button>

          {/* Lock */}
          <button
            title={layer.locked ? "Unlock" : "Lock"}
            onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
            className="w-5 h-5 flex items-center justify-center text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors rounded"
          >
            {layer.locked ? "🔒" : "🔓"}
          </button>

          {/* ··· Menu */}
          <div className="relative">
            <button
              title="More options"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
              className="w-5 h-5 flex items-center justify-center text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors rounded leading-none"
            >
              ···
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                <div
                  className="absolute right-0 top-full mt-0.5 w-32 rounded-lg overflow-hidden z-50 border border-zinc-700/80"
                  style={{ background: "#141416", boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}
                >
                  {[
                    { label: "Duplicate", fn: () => { onDuplicate(); setMenuOpen(false); } },
                    { label: "Move up",   fn: () => { onMoveUp();    setMenuOpen(false); } },
                    { label: "Move down", fn: () => { onMoveDown();  setMenuOpen(false); } },
                  ].map(({ label, fn }) => (
                    <button
                      key={label}
                      onClick={(e) => { e.stopPropagation(); fn(); }}
                      className="w-full text-left px-3 py-2 text-[12px] font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                  <div className="border-t border-zinc-800/60 my-0.5" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${layer.label}"?`)) { onDelete(); }
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[12px] font-medium text-red-400/70 hover:text-red-400 hover:bg-zinc-800/60 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add button ───────────────────────────────────────────────────────────────

function AddBtn({ children, onClick, title, label }: {
  children?: React.ReactNode;
  onClick: () => void;
  title: string;
  label?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="py-1.5 text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors border border-zinc-800/80 hover:border-zinc-600 rounded-md"
    >
      {label ?? children}
    </button>
  );
}
