"use client";
import { usePosterStore } from "@/store/posterStore";
import type { PosterLayer } from "@/types/poster";

export function QuickPanel() {
  const {
    project,
    brushActive, brushColor, brushSize, brushOpacity,
    setBrushActive, setBrushColor, setBrushSize, setBrushOpacity,
    addLayer, getSortedLayers,
  } = usePosterStore();

  if (!project) return null;

  function toggleBrush() {
    const layers = getSortedLayers();
    if (!brushActive) {
      const existing = layers.find((l) => l.type === "drawingLayer");
      if (!existing) {
        const canvas = project!.canvas;
        const newLayer: PosterLayer = {
          id: crypto.randomUUID(),
          type: "drawingLayer",
          label: "Drawing",
          x: 0, y: 0,
          width: canvas.width, height: canvas.height,
          rotation: 0, opacity: 1,
          visible: true, locked: false,
          zIndex: 0,
          imageData: { src: "", fit: "fill" },
        };
        addLayer(newLayer);
      }
    }
    setBrushActive(!brushActive);
  }

  return (
    <div
      className="flex flex-col items-center gap-1.5 py-2.5 px-1.5 rounded-xl self-start"
      style={{
        background: "rgba(8,8,10,0.88)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        minWidth: 36,
      }}
    >
      <QBtn title="Undo (⌘Z)" onClick={() => usePosterStore.getState().undo()}>↩</QBtn>
      <QBtn title="Redo (⌘⇧Z)" onClick={() => usePosterStore.getState().redo()}>↪</QBtn>

      <div className="w-4 h-px my-0.5" style={{ background: "rgba(255,255,255,0.08)" }} />

      <QBtn title="Brush / Draw" onClick={toggleBrush} active={brushActive}>✏</QBtn>

      {/* Color swatch */}
      <label
        title="Brush color"
        className="w-6 h-6 rounded cursor-pointer flex-none block"
        style={{ background: brushColor, border: "1px solid rgba(255,255,255,0.18)" }}
      >
        <input
          type="color"
          value={brushColor}
          onChange={(e) => setBrushColor(e.target.value)}
          className="sr-only"
        />
      </label>

      <div className="w-4 h-px my-0.5" style={{ background: "rgba(255,255,255,0.08)" }} />

      <span className="font-mono text-[8px] text-zinc-700 select-none">sz</span>

      {/* Brush size — rotate trick for vertical range */}
      <div className="relative flex items-center justify-center" style={{ width: 20, height: 72 }}>
        <input
          type="range"
          min={1} max={60}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          title={`Size: ${brushSize}px`}
          style={{
            position: "absolute",
            width: 68,
            height: 18,
            top: 25,
            left: -24,
            transform: "rotate(-90deg)",
            cursor: "pointer",
            accentColor: "#a1a1aa",
          }}
        />
      </div>

      <span className="font-mono text-[8px] text-zinc-700 select-none">op</span>

      <div className="relative flex items-center justify-center" style={{ width: 20, height: 60 }}>
        <input
          type="range"
          min={10} max={100}
          value={Math.round(brushOpacity * 100)}
          onChange={(e) => setBrushOpacity(Number(e.target.value) / 100)}
          title={`Opacity: ${Math.round(brushOpacity * 100)}%`}
          style={{
            position: "absolute",
            width: 56,
            height: 18,
            top: 21,
            left: -18,
            transform: "rotate(-90deg)",
            cursor: "pointer",
            accentColor: "#a1a1aa",
          }}
        />
      </div>
    </div>
  );
}

function QBtn({
  children, title, onClick, active,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`w-7 h-7 flex items-center justify-center rounded text-sm transition-colors select-none ${
        active
          ? "bg-zinc-700 text-zinc-100"
          : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}
