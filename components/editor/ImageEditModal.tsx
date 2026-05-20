"use client";
import { useState, useEffect } from "react";
import { usePosterStore } from "@/store/posterStore";
import type { ImageAdjustments } from "@/types/poster";
import { CutoutModal } from "./CutoutModal";

const DEFAULT_ADJ: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  highlights: 0,
  shadows: 0,
};

const SLIDERS: { key: keyof ImageAdjustments; label: string; min: number; max: number }[] = [
  { key: "brightness",  label: "Exposure",    min: -100, max: 100 },
  { key: "contrast",    label: "Contrast",    min: -100, max: 100 },
  { key: "saturation",  label: "Saturation",  min: -100, max: 100 },
  { key: "temperature", label: "Temperature", min: -100, max: 100 },
  { key: "highlights",  label: "Highlights",  min: -100, max: 100 },
  { key: "shadows",     label: "Shadows",     min: -100, max: 100 },
];

function adjToCSS(adj: ImageAdjustments): string {
  const bright = 1 + adj.brightness / 100;
  const cont   = 1 + adj.contrast   / 100;
  const sat    = 1 + adj.saturation / 100;
  // Temperature: warm = sepia-like, cool = hue-rotate
  const hueRot = adj.temperature * -0.5; // warm → negative hue, cool → positive
  const sepia  = Math.max(0, adj.temperature / 200); // subtle sepia for warmth
  const parts: string[] = [
    `brightness(${bright.toFixed(3)})`,
    `contrast(${cont.toFixed(3)})`,
    `saturate(${Math.max(0, sat).toFixed(3)})`,
  ];
  if (Math.abs(hueRot) > 1) parts.push(`hue-rotate(${hueRot.toFixed(1)}deg)`);
  if (sepia > 0.01) parts.push(`sepia(${sepia.toFixed(3)})`);
  // Highlights / shadows via brightness with a secondary pass (approximation)
  if (adj.highlights !== 0) parts.push(`brightness(${(1 + adj.highlights / 300).toFixed(3)})`);
  return parts.join(" ");
}

async function applyAdjToDataUrl(src: string, adj: ImageAdjustments): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new window.Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.filter = adjToCSS(adj);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export function ImageEditModal({ layerId, onClose }: { layerId: string; onClose: () => void }) {
  const { getLayerById, updateLayer, pushHistory } = usePosterStore();
  const layer = getLayerById(layerId);

  const [adj, setAdj] = useState<ImageAdjustments>(() => ({
    ...DEFAULT_ADJ,
    ...(layer?.imageData?.adjustments ?? {}),
  }));
  const [applying, setApplying] = useState(false);
  const [showCutout, setShowCutout] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!layer || !layer.imageData) return null;

  const originalSrc = layer.imageData.originalSrc ?? layer.imageData.src;
  const previewSrc = originalSrc;
  const hasChanges = Object.values(adj).some((v) => v !== 0);

  function setSlider(key: keyof ImageAdjustments, value: number) {
    setAdj((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setAdj({ ...DEFAULT_ADJ });
  }

  async function handleApply() {
    if (!hasChanges) { onClose(); return; }
    setApplying(true);
    try {
      const newSrc = await applyAdjToDataUrl(originalSrc, adj);
      pushHistory();
      updateLayer(layerId, {
        imageData: {
          ...layer!.imageData!,
          src: newSrc,
          originalSrc: originalSrc,
          adjustments: adj,
        },
      });
      onClose();
    } catch {
      // fallback: store adjustments only
      updateLayer(layerId, { imageData: { ...layer!.imageData!, adjustments: adj } });
      onClose();
    } finally {
      setApplying(false);
    }
  }

  const cssFilter = hasChanges ? adjToCSS(adj) : "none";

  if (showCutout) {
    return (
      <CutoutModal
        sourceLayerId={layerId}
        onClose={() => setShowCutout(false)}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(20px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex overflow-hidden rounded-lg"
        style={{
          background: "rgba(10,10,12,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          maxWidth: "90vw",
          maxHeight: "90vh",
          width: 900,
        }}
      >
        {/* Preview pane */}
        <div
          className="flex-1 flex items-center justify-center min-w-0 relative"
          style={{ background: "#050507", minHeight: 500 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc}
            alt="preview"
            className="max-w-full max-h-full object-contain"
            style={{ filter: cssFilter, transition: "filter 0.1s ease" }}
          />
          <div
            className="absolute bottom-3 left-3 font-mono text-[8px] text-zinc-700 tracking-wide"
          >
            {layer.label}
          </div>
        </div>

        {/* Controls pane */}
        <div
          className="w-64 flex-none flex flex-col overflow-hidden"
          style={{ borderLeft: "1px solid rgba(255,255,255,0.07)" }}
        >
          {/* Header */}
          <div
            className="flex-none flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-zinc-400">Edit Image</span>
            <button
              onClick={onClose}
              className="font-mono text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Sliders */}
          <div className="flex-1 overflow-y-auto py-3 space-y-1">
            {SLIDERS.map(({ key, label, min, max }) => (
              <div key={key} className="px-4">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-mono text-[9px] tracking-wide uppercase text-zinc-600">{label}</span>
                  <span className="font-mono text-[9px] text-zinc-500">{adj[key] > 0 ? "+" : ""}{adj[key]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={1}
                    value={adj[key]}
                    onChange={(e) => setSlider(key, Number(e.target.value))}
                    className="flex-1 h-0.5 accent-zinc-400"
                    style={{ cursor: "ew-resize" }}
                  />
                </div>
                {/* Center tick */}
                <div className="flex justify-center mt-0.5">
                  <div className="w-px h-1 bg-zinc-800" />
                </div>
              </div>
            ))}

            {/* Cutout tools */}
            <div className="px-4 pt-3">
              <div
                className="text-[9px] tracking-[0.2em] uppercase text-zinc-600 pb-2"
                style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12 }}
              >
                Cutout
              </div>
              <button
                onClick={() => setShowCutout(true)}
                className="w-full border border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-zinc-200 text-[10px] tracking-wide uppercase py-2 transition-colors"
              >
                Extract / Lasso / Brush
              </button>
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex-none px-4 py-3 flex flex-col gap-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
          >
            {hasChanges && (
              <button
                onClick={reset}
                className="w-full font-mono text-[9px] tracking-wide uppercase text-zinc-600 hover:text-zinc-400 transition-colors py-1"
              >
                Reset
              </button>
            )}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 border border-zinc-800 hover:border-zinc-600 font-mono text-[9px] tracking-wide uppercase text-zinc-600 hover:text-zinc-300 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={applying}
                className="flex-1 font-mono text-[9px] tracking-wide uppercase py-2 transition-colors disabled:opacity-30"
                style={{
                  background: hasChanges ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: hasChanges ? "#e4e4e7" : "#52525b",
                }}
              >
                {applying ? "Applying…" : "Apply"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

