"use client";
import { usePosterStore } from "@/store/posterStore";

const SAFE_MARGIN = 48; // canvas-coordinate safe margin

export function AlignmentBar() {
  const { project, selectedLayerId, getLayerById, updateLayer } = usePosterStore();

  if (!project) return null;

  const layer = selectedLayerId ? getLayerById(selectedLayerId) : null;
  const { width: cw, height: ch } = project.canvas;
  const dim = !layer;

  type AlignAction = "center-h" | "center-v" | "left" | "right" | "top" | "bottom";

  function align(action: AlignAction) {
    if (!layer) return;
    switch (action) {
      case "center-h": updateLayer(layer.id, { x: Math.round((cw - layer.width) / 2) }); break;
      case "center-v": updateLayer(layer.id, { y: Math.round((ch - layer.height) / 2) }); break;
      case "left":     updateLayer(layer.id, { x: SAFE_MARGIN }); break;
      case "right":    updateLayer(layer.id, { x: cw - layer.width - SAFE_MARGIN }); break;
      case "top":      updateLayer(layer.id, { y: SAFE_MARGIN }); break;
      case "bottom":   updateLayer(layer.id, { y: ch - layer.height - SAFE_MARGIN }); break;
    }
  }

  const actions: { id: AlignAction; label: string; title: string }[] = [
    { id: "center-h", label: "↔",  title: "Center horizontally" },
    { id: "center-v", label: "↕",  title: "Center vertically" },
    { id: "left",     label: "⊣",  title: "Snap left (with margin)" },
    { id: "right",    label: "⊢",  title: "Snap right (with margin)" },
    { id: "top",      label: "⊤",  title: "Snap top (with margin)" },
    { id: "bottom",   label: "⊥",  title: "Snap bottom (with margin)" },
  ];

  return (
    <div className="flex items-center gap-0.5 px-1">
      {actions.map((a, i) => (
        <span key={a.id}>
          {i === 2 && (
            <span className="mx-1.5" style={{ color: "rgba(255,255,255,0.1)" }}>|</span>
          )}
          <button
            onClick={() => align(a.id)}
            disabled={dim}
            title={a.title}
            className="w-6 h-6 flex items-center justify-center font-mono text-[11px] rounded-sm transition-colors disabled:opacity-20 hover:bg-white/[0.06]"
            style={{ color: dim ? "#3f3f46" : "#71717a" }}
          >
            {a.label}
          </button>
        </span>
      ))}
    </div>
  );
}
