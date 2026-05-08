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
  gradientLayer:    "grad",
  textureLayer:     "grain",
};

// ─── Grain generator (client-side, runs in browser) ───────────────────────────

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

  // Display order: highest zIndex first (top of stack = top of list)
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

    // Normalise zIndex: top item (index 0) = highest value
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
    // Layer 1: soft radial gradient (deep violet → transparent) on soft-light
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
    // Layer 2: fine grain texture on overlay
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
      <div className="flex-1 py-3 overflow-y-auto">
        <div className="px-4 pb-2 font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-700">
          Layers
        </div>

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

          {/* Floating drag preview */}
          <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
            {activeLayer ? (
              <div
                className="rounded-sm"
                style={{
                  background: "rgba(24,24,27,0.97)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
                }}
              >
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
      <div
        className="flex-none px-3 py-2 space-y-1.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="font-mono text-[8px] tracking-[0.2em] uppercase text-zinc-800">Add layer</div>
        <div className="flex gap-1">
          <AddBtn onClick={addTextLayer}                   title="Text layer">T</AddBtn>
          <AddBtn onClick={() => fileInputRef.current?.click()} title="Image layer">⬡</AddBtn>
          <AddBtn onClick={addDrawingLayer}                title="Drawing / brush layer">✏</AddBtn>
          <AddBtn onClick={addGradientLayer}               title="Gradient layer">◈</AddBtn>
          <AddBtn onClick={addTextureLayer}                title="Grain / texture layer">⣿</AddBtn>
        </div>

        <div className="font-mono text-[8px] tracking-[0.2em] uppercase text-zinc-800 pt-1">Preset</div>
        <button
          onClick={addAtmosphericPreset}
          className="w-full py-1 font-mono text-[8px] tracking-wide uppercase text-zinc-600 hover:text-zinc-200 transition-colors rounded-sm"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          title="Adds a violet radial gradient + film grain layer stack"
        >
          + Atmospheric blur
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
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: "relative",
  };

  const handle = (
    <button
      {...attributes}
      {...listeners}
      tabIndex={-1}
      className="flex-none w-4 h-full flex items-center justify-center cursor-grab active:cursor-grabbing select-none text-zinc-800 hover:text-zinc-500 transition-colors"
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
  return (
    <div
      onClick={onSelect}
      className={`group flex items-center gap-1.5 pl-1 pr-3 py-1.5 transition-colors ${
        isDragging
          ? "bg-zinc-800 text-zinc-200"
          : selected
          ? "bg-zinc-900 text-zinc-200 cursor-pointer"
          : "hover:bg-zinc-950 text-zinc-500 cursor-pointer"
      } ${!layer.visible ? "opacity-30" : ""}`}
    >
      {/* Drag handle */}
      {dragHandle ?? <span className="w-4 flex-none" />}

      {/* Type badge */}
      <span className={`font-mono text-[9px] tracking-wide w-10 flex-none ${selected ? "text-zinc-500" : "text-zinc-700"}`}>
        {TYPE_LABEL[layer.type] ?? layer.type.slice(0, 5)}
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
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
        <Btn
          title="delete"
          onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${layer.label}"?`)) onDelete(); }}
          className="hover:text-red-500"
        >×</Btn>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
