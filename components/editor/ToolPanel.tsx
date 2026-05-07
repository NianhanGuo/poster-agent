"use client";
import { useState } from "react";
import { usePosterStore } from "@/store/posterStore";
import { ImageUploadPanel } from "./ImageUploadPanel";
import { FontPicker } from "./FontPicker";
import { FONT_LIST, loadGoogleFont } from "@/lib/fonts";
import { GRADIENT_PRESETS, EFFECTS, COLOR_SWATCHES } from "@/lib/textEffects";
import type { PosterLayer } from "@/types/poster";
import { isTextLayer, isImageLayer } from "@/types/poster";

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

  const onText = (u: Partial<NonNullable<PosterLayer["textData"]>>) => {
    if (selected) updateTextData(selected.id, u);
  };
  const onLayer = (u: Partial<PosterLayer>) => {
    if (selected) updateLayer(selected.id, u);
  };

  return (
    <div className="py-3 space-y-1 text-xs select-none">
      {/* Add */}
      <Section label="Add" />
      <div className="px-4 flex gap-2 pb-2">
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
        <div className="px-4 pb-2">
          <ImageUploadPanel onClose={() => setShowImageUpload(false)} />
        </div>
      )}

      {!selected && (
        <div className="px-4 pt-2 font-mono text-[10px] text-zinc-700">select a layer</div>
      )}

      {selected && textSelected && selected.textData && (
        <TextInspector td={selected.textData} layer={selected} onText={onText} onLayer={onLayer} />
      )}

      {selected && imageSelected && (
        <ImageInspector layer={selected} onLayer={onLayer} />
      )}

      {selected && (
        <TransformInspector layer={selected} onLayer={onLayer} />
      )}
    </div>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────

function Section({ label }: { label: string }) {
  return (
    <div className="px-4 pt-3 pb-1 font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-700 border-t border-zinc-900">
      {label}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 py-0.5 min-h-[26px]">
      <span className="font-mono text-[9px] tracking-wide uppercase text-zinc-700 w-14 flex-none">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function SliderRow({
  label, min, max, step = 1, value, onChange, display,
}: {
  label: string; min: number; max: number; step?: number;
  value: number; onChange: (v: number) => void; display?: string;
}) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-2">
        <input
          type="range" min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-0.5 accent-zinc-400"
        />
        <span className="font-mono text-[9px] text-zinc-600 w-8 text-right flex-none">
          {display ?? value}
        </span>
      </div>
    </Row>
  );
}

// ─── Text inspector ─────────────────────────────────────────────────────────

function TextInspector({
  td, layer, onText, onLayer,
}: {
  td: NonNullable<PosterLayer["textData"]>;
  layer: PosterLayer;
  onText: (u: Partial<NonNullable<PosterLayer["textData"]>>) => void;
  onLayer: (u: Partial<PosterLayer>) => void;
}) {
  const fontWeight = td.fontWeight ?? 400;
  const italic = td.italic ?? false;
  const activeEffects = new Set(td.effects ?? []);

  function toggleEffect(id: string) {
    const next = new Set(activeEffects);
    next.has(id) ? next.delete(id) : next.add(id);
    const effects = [...next];

    // Derive Konva props from effects
    const hasShadow = next.has("shadow");
    const hasOutline = next.has("outline");
    const hasNeon = next.has("neon");
    const neonColor = td.fill ?? "#ffffff";

    onText({
      effects,
      textDecoration: [
        next.has("underline") ? "underline" : "",
        next.has("strikethrough") ? "line-through" : "",
      ].filter(Boolean).join(" ") || undefined,
      shadowEnabled: hasShadow || hasNeon,
      shadowColor: hasNeon ? neonColor : (hasShadow ? (td.shadowColor ?? "#000000") : undefined),
      shadowBlur: hasNeon ? 28 : (hasShadow ? (td.shadowBlur ?? 8) : undefined),
      shadowOffsetX: hasNeon ? 0 : (hasShadow ? (td.shadowOffsetX ?? 4) : undefined),
      shadowOffsetY: hasNeon ? 0 : (hasShadow ? (td.shadowOffsetY ?? 4) : undefined),
      stroke: hasOutline ? (td.stroke ?? "#ffffff") : undefined,
      strokeWidth: hasOutline ? (td.strokeWidth ?? 2) : undefined,
    });
  }

  function setFontWeight(w: number) {
    const style = italic ? `italic ${w}` : w === 400 ? "normal" : `${w}`;
    onText({ fontWeight: w, fontStyle: style });
    // Reload with new weight
    loadGoogleFont(td.fontFamily, [w]);
  }

  function setItalic(on: boolean) {
    const w = fontWeight;
    const style = on ? `italic ${w}` : w === 400 ? "normal" : `${w}`;
    onText({ italic: on, fontStyle: style });
    loadGoogleFont(td.fontFamily, [w]);
  }

  function setFont(family: string, availableWeights: number[]) {
    const w = availableWeights.includes(fontWeight) ? fontWeight : (availableWeights.includes(400) ? 400 : availableWeights[0]);
    const style = italic ? `italic ${w}` : w === 400 ? "normal" : `${w}`;
    onText({ fontFamily: family, fontWeight: w, fontStyle: style });
  }

  // Find available weights for current font
  const fontDef = FONT_LIST.find((f) => f.family === td.fontFamily);
  const availableWeights = fontDef?.weights ?? [400, 700];

  return (
    <>
      {/* Typography */}
      <Section label="Font" />
      <div className="px-4 pb-1">
        <FontPicker value={td.fontFamily} weight={fontWeight} onChange={setFont} />
      </div>

      <Row label="Weight">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={100} max={900} step={100}
            value={fontWeight}
            onChange={(e) => setFontWeight(Number(e.target.value))}
            className="flex-1 h-0.5 accent-zinc-400"
            // Snap to available weights visually
          />
          <span className="font-mono text-[9px] text-zinc-600 w-8 text-right flex-none">{fontWeight}</span>
        </div>
      </Row>

      {/* ── Alignment — segmented control ── */}
      <Section label="Align" />
      <div className="px-4 pb-1">
        <div
          className="flex overflow-hidden rounded-sm"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {(["left", "center", "right", "justify"] as const).map((a, i) => {
            const labels: Record<string, string> = {
              left: "Left", center: "Center", right: "Right", justify: "Justify",
            };
            const active = td.align === a;
            return (
              <button
                key={a}
                onClick={() => onText({ align: a })}
                title={labels[a]}
                className="flex-1 py-1.5 font-mono text-[9px] tracking-wide transition-colors"
                style={{
                  background: active ? "rgba(255,255,255,0.10)" : "transparent",
                  color: active ? "#e4e4e7" : "#52525b",
                  borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.08)" : "none",
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#a1a1aa"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#52525b"; }}
              >
                {a === "left" ? "L" : a === "center" ? "C" : a === "right" ? "R" : "J"}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Italic / Style ── */}
      <Row label="Style">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setItalic(!italic)}
            className="border px-2 py-0.5 font-mono text-[9px] italic transition-colors"
            style={{
              borderColor: italic ? "rgba(161,161,170,0.5)" : "rgba(255,255,255,0.1)",
              color: italic ? "#e4e4e7" : "#52525b",
            }}
          >
            I
          </button>
        </div>
      </Row>

      <SliderRow label="Size" min={8} max={400} value={td.fontSize} onChange={(v) => onText({ fontSize: v })} display={`${td.fontSize}px`} />
      <SliderRow label="Spacing" min={-10} max={60} value={td.letterSpacing ?? 0} onChange={(v) => onText({ letterSpacing: v })} display={`${td.letterSpacing ?? 0}`} />
      <SliderRow label="Leading" min={0.7} max={3.5} step={0.05} value={td.lineHeight ?? 1.2} onChange={(v) => onText({ lineHeight: v })} display={(td.lineHeight ?? 1.2).toFixed(2)} />

      {/* Text content */}
      <Section label="Text" />
      <div className="px-4 pb-1">
        <textarea
          value={td.text}
          onChange={(e) => onText({ text: e.target.value })}
          rows={3}
          className="w-full bg-transparent border-b border-zinc-800 focus:border-zinc-600 text-zinc-300 font-mono text-[10px] outline-none pb-1 resize-none transition-colors"
        />
      </div>

      {/* Color */}
      <Section label="Color" />
      {/* Swatches */}
      <div className="px-4 pb-1">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {COLOR_SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => onText({ fill: c, fillGradient: undefined })}
              className="w-5 h-5 rounded-sm border border-zinc-800 hover:scale-110 transition-transform"
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={td.fill}
            onChange={(e) => onText({ fill: e.target.value, fillGradient: undefined })}
            className="w-5 h-5 bg-transparent border-0 cursor-pointer"
          />
          <input
            type="text"
            value={td.fill}
            onChange={(e) => onText({ fill: e.target.value, fillGradient: undefined })}
            className="flex-1 bg-transparent border-b border-zinc-800 text-zinc-300 font-mono text-[10px] outline-none pb-0.5"
          />
        </div>
      </div>

      {/* Gradient */}
      <Section label="Gradient" />
      <div className="px-4 pb-1 flex flex-wrap gap-1.5">
        {GRADIENT_PRESETS.map((g) => {
          const active = (td.fillGradient ?? "none") === g.id;
          const previewStyle =
            g.id === "none"
              ? { background: "#222" }
              : {
                  background: `linear-gradient(135deg, ${(g.colorStops as (string | number)[])
                    .filter((s) => typeof s === "string")
                    .join(", ")})`,
                };
          return (
            <button
              key={g.id}
              title={g.label}
              onClick={() => onText({ fillGradient: g.id === "none" ? undefined : g.id })}
              className={`w-8 h-5 rounded-sm border transition-colors ${
                active ? "border-zinc-400 scale-110" : "border-zinc-800 hover:border-zinc-600"
              }`}
              style={previewStyle}
            />
          );
        })}
      </div>

      {/* Effects */}
      <Section label="Effects" />
      <div className="px-4 pb-1 flex flex-wrap gap-1.5">
        {EFFECTS.map((ef) => {
          const active = activeEffects.has(ef.id);
          return (
            <button
              key={ef.id}
              onClick={() => toggleEffect(ef.id)}
              title={ef.konvaSupported ? ef.label : `${ef.label} (not available in canvas)`}
              className={`font-mono text-[9px] tracking-wide uppercase px-2 py-0.5 border transition-colors ${
                active
                  ? "border-zinc-400 text-zinc-200 bg-zinc-900"
                  : "border-zinc-800 text-zinc-600 hover:border-zinc-600"
              } ${!ef.konvaSupported ? "opacity-40" : ""}`}
            >
              {ef.label}
            </button>
          );
        })}
      </div>

      {/* Shadow controls (when shadow or neon active) */}
      {(activeEffects.has("shadow") || activeEffects.has("neon")) && (
        <>
          <Section label="Shadow" />
          {activeEffects.has("shadow") && (
            <>
              <Row label="Color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={td.shadowColor ?? "#000000"}
                    onChange={(e) => onText({ shadowColor: e.target.value })}
                    className="w-5 h-5 bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={td.shadowColor ?? "#000000"}
                    onChange={(e) => onText({ shadowColor: e.target.value })}
                    className="flex-1 bg-transparent border-b border-zinc-800 text-zinc-300 font-mono text-[10px] outline-none pb-0.5"
                  />
                </div>
              </Row>
              <SliderRow label="Offset X" min={-28} max={28} value={td.shadowOffsetX ?? 4} onChange={(v) => onText({ shadowOffsetX: v })} />
              <SliderRow label="Offset Y" min={-28} max={28} value={td.shadowOffsetY ?? 4} onChange={(v) => onText({ shadowOffsetY: v })} />
            </>
          )}
          <SliderRow label="Blur" min={0} max={50} value={td.shadowBlur ?? 8} onChange={(v) => onText({ shadowBlur: v })} display={`${td.shadowBlur ?? 8}px`} />
        </>
      )}

      {/* Outline controls (when outline active) */}
      {activeEffects.has("outline") && (
        <>
          <Section label="Outline" />
          <Row label="Color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={td.stroke ?? "#ffffff"}
                onChange={(e) => onText({ stroke: e.target.value })}
                className="w-5 h-5 bg-transparent border-0 cursor-pointer"
              />
              <input
                type="text"
                value={td.stroke ?? "#ffffff"}
                onChange={(e) => onText({ stroke: e.target.value })}
                className="flex-1 bg-transparent border-b border-zinc-800 text-zinc-300 font-mono text-[10px] outline-none pb-0.5"
              />
            </div>
          </Row>
          <SliderRow label="Width" min={1} max={20} value={td.strokeWidth ?? 2} onChange={(v) => onText({ strokeWidth: v })} display={`${td.strokeWidth ?? 2}px`} />
        </>
      )}
    </>
  );
}

// ─── Image inspector ───────────────────────────────────────────────────────────

function ImageInspector({ layer, onLayer }: {
  layer: PosterLayer;
  onLayer: (u: Partial<PosterLayer>) => void;
}) {
  return (
    <>
      <Section label="Image" />
      <Row label="Src">
        <input
          type="text"
          value={layer.imageData?.src ?? ""}
          onChange={(e) => onLayer({ imageData: { ...(layer.imageData ?? {}), src: e.target.value } })}
          placeholder="https://… or data:image/…"
          className="w-full bg-transparent border-b border-zinc-800 text-zinc-300 font-mono text-[10px] outline-none pb-0.5 placeholder:text-zinc-700"
        />
      </Row>
    </>
  );
}

// ─── Transform inspector ───────────────────────────────────────────────────────

function TransformInspector({ layer, onLayer }: {
  layer: PosterLayer;
  onLayer: (u: Partial<PosterLayer>) => void;
}) {
  return (
    <>
      <Section label="Transform" />
      <div className="px-4 grid grid-cols-2 gap-x-3 gap-y-2 pb-1">
        {[
          { label: "X",  value: Math.round(layer.x),      key: "x" },
          { label: "Y",  value: Math.round(layer.y),      key: "y" },
          { label: "W",  value: Math.round(layer.width),  key: "width" },
          { label: "H",  value: Math.round(layer.height), key: "height" },
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
            className="flex-1 h-0.5 accent-zinc-400"
          />
          <span className="font-mono text-[9px] text-zinc-600 w-8 text-right flex-none">{Math.round(layer.rotation)}°</span>
        </div>
      </Row>

      <Row label="Opacity">
        <div className="flex items-center gap-2">
          <input
            type="range" min={0} max={1} step={0.01}
            value={layer.opacity}
            onChange={(e) => onLayer({ opacity: Number(e.target.value) })}
            className="flex-1 h-0.5 accent-zinc-400"
          />
          <span className="font-mono text-[9px] text-zinc-600 w-8 text-right flex-none">{Math.round(layer.opacity * 100)}%</span>
        </div>
      </Row>

      <Row label="Z">
        <input
          type="number"
          value={layer.zIndex}
          onChange={(e) => onLayer({ zIndex: Number(e.target.value) })}
          className="w-full bg-transparent border-b border-zinc-800 text-zinc-300 font-mono text-[10px] outline-none pb-0.5"
        />
      </Row>
    </>
  );
}
