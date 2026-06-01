"use client";
import { useState } from "react";
import { usePosterStore } from "@/store/posterStore";
import { ImageUploadPanel } from "./ImageUploadPanel";
import { FontPicker } from "./FontPicker";
import { loadGoogleFont } from "@/lib/fonts";
import { GRADIENT_PRESETS, EFFECTS } from "@/lib/textEffects";
import type { PosterLayer, BlendMode, GradientColorStop } from "@/types/poster";
import { isTextLayer, isImageLayer } from "@/types/poster";

const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: "normal",      label: "Normal" },
  { value: "multiply",    label: "Multiply" },
  { value: "screen",      label: "Screen" },
  { value: "overlay",     label: "Overlay" },
  { value: "soft-light",  label: "Soft Light" },
  { value: "hard-light",  label: "Hard Light" },
  { value: "color-dodge", label: "Color Dodge" },
  { value: "color-burn",  label: "Color Burn" },
  { value: "darken",      label: "Darken" },
  { value: "lighten",     label: "Lighten" },
  { value: "color",       label: "Color" },
  { value: "luminosity",  label: "Luminosity" },
  { value: "difference",  label: "Difference" },
  { value: "exclusion",   label: "Exclusion" },
];

interface ToolPanelProps {
  onTypography?: (styleHint?: string) => void;
  onEditImage?: (layerId: string) => void;
  onCutout?: (layerId: string) => void;
}

// ─── Collapsible section ───────────────────────────────────────────────────────

function CollapsibleSection({
  label,
  defaultOpen = true,
  badge,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-3 py-2 hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500">
            {label}
          </span>
          {badge && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 uppercase tracking-wider">
              {badge}
            </span>
          )}
        </div>
        <span className={`text-zinc-700 text-[9px] transition-transform duration-150 ${open ? "rotate-90" : ""}`}>
          ▶
        </span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
  return <div className="border-t border-zinc-800/60 mx-3 my-0.5" />;
}

// ─── Label ────────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium text-zinc-500 block mb-1">{children}</span>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1 min-h-[28px]">
      <span className="text-[11px] font-medium text-zinc-500 w-16 flex-none">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ─── SliderRow ────────────────────────────────────────────────────────────────

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
        <span className="font-mono text-[11px] text-zinc-500 w-9 text-right flex-none">
          {display ?? value}
        </span>
      </div>
    </Row>
  );
}

// ─── NumberInput ──────────────────────────────────────────────────────────────

function NumberInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 font-mono text-[12px] text-zinc-200 outline-none focus:border-zinc-600 transition-colors"
      />
    </div>
  );
}

// ─── Main ToolPanel ───────────────────────────────────────────────────────────

export function ToolPanel({ onTypography, onEditImage, onCutout }: ToolPanelProps) {
  const { project, selectedLayerId, getLayerById, updateLayer, updateTextData, addLayer } =
    usePosterStore();
  const designRationale = usePosterStore((s) => s.designRationale);
  const generatedPalette = usePosterStore((s) => s.generatedPalette);
  const [showImageUpload, setShowImageUpload] = useState(false);

  if (!project) return null;

  const selected = selectedLayerId ? getLayerById(selectedLayerId) : null;
  const textSelected    = selected ? isTextLayer(selected.type) : false;
  const imageSelected   = selected ? isImageLayer(selected.type) : false;
  const gradientSelected = selected?.type === "gradientLayer";
  const textureSelected  = selected?.type === "textureLayer";
  const shapeSelected    = selected?.type === "geometricShape" || selected?.type === "accentLine";
  const overlaySelected  = selected?.type === "colorOverlay";

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

  const onText = (u: Partial<NonNullable<PosterLayer["textData"]>>) => {
    if (selected) updateTextData(selected.id, u);
  };
  const onLayer = (u: Partial<PosterLayer>) => {
    if (selected) updateLayer(selected.id, u);
  };

  return (
    <div className="py-2 space-y-0 text-xs select-none">

      {/* Design intent */}
      {designRationale && (
        <div className="px-3 py-2 border-b border-zinc-800/60">
          <Label>Design intent</Label>
          <div className="text-[11px] text-zinc-500 italic leading-relaxed">{designRationale}</div>
        </div>
      )}

      {/* Generated palette */}
      {generatedPalette && (
        <div className="px-3 py-2 border-b border-zinc-800/60">
          <Label>Palette</Label>
          <div className="flex gap-1.5">
            {Object.entries(generatedPalette).map(([key, color]) => (
              <button
                key={key}
                title={`${key}: ${color}`}
                onClick={() => {
                  if (!selected) return;
                  if (selected.textData) {
                    updateTextData(selected.id, { fill: color });
                  }
                }}
                className="w-6 h-6 rounded border border-zinc-800 hover:scale-110 transition-transform flex-none"
                style={{ background: color }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add layer buttons */}
      <div className="px-3 pt-2 pb-2 flex gap-2">
        <button
          onClick={addTextLayer}
          className="flex-1 border border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-zinc-200 text-[12px] font-medium py-1.5 rounded-md transition-colors"
        >
          + Text
        </button>
        <button
          onClick={() => setShowImageUpload(!showImageUpload)}
          className="flex-1 border border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-zinc-200 text-[12px] font-medium py-1.5 rounded-md transition-colors"
        >
          + Image
        </button>
      </div>
      {showImageUpload && (
        <div className="px-3 pb-2">
          <ImageUploadPanel onClose={() => setShowImageUpload(false)} />
        </div>
      )}

      {!selected && (
        <div className="px-3 pt-2 text-[12px] text-zinc-600 italic">Select a layer to edit it</div>
      )}

      {selected && textSelected && selected.textData && (
        <TextInspector td={selected.textData} onText={onText} onTypography={onTypography} layer={selected} onLayer={onLayer} />
      )}

      {selected && imageSelected && !gradientSelected && !textureSelected && (
        <ImageInspector layer={selected} onLayer={onLayer} onEditImage={onEditImage} onCutout={onCutout} />
      )}

      {selected && gradientSelected && (
        <GradientLayerInspector layer={selected} onLayer={onLayer} />
      )}

      {selected && textureSelected && (
        <TextureLayerInspector layer={selected} onLayer={onLayer} />
      )}

      {selected && (shapeSelected || overlaySelected) && (
        <ShapeInspector layer={selected} onLayer={onLayer} />
      )}

      {selected && (
        <>
          <Divider />
          <TransformInspector layer={selected} onLayer={onLayer} />
        </>
      )}
    </div>
  );
}

// ─── Text inspector ────────────────────────────────────────────────────────────

function TextInspector({
  td, onText, onTypography, layer, onLayer,
}: {
  td: NonNullable<PosterLayer["textData"]>;
  onText: (u: Partial<NonNullable<PosterLayer["textData"]>>) => void;
  onTypography?: (styleHint?: string) => void;
  layer?: PosterLayer;
  onLayer?: (u: Partial<PosterLayer>) => void;
}) {
  const fontWeight = td.fontWeight ?? 400;
  const italic = td.italic ?? false;
  const activeEffects = new Set(td.effects ?? []);

  function toggleEffect(id: string) {
    const next = new Set(activeEffects);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    const effects = [...next];
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

  return (
    <>
      <Divider />

      {/* ── BASIC: always open ── */}
      <div className="px-3 pt-1 pb-1">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500 mb-2">Font</div>
        <FontPicker value={td.fontFamily} onChange={setFont} />
      </div>

      {/* Size + Weight in one row */}
      <div className="px-3 pb-1 grid grid-cols-2 gap-2">
        <div>
          <Label>Size</Label>
          <div className="flex items-center gap-1">
            <input
              type="range" min={8} max={400}
              value={td.fontSize}
              onChange={(e) => onText({ fontSize: Number(e.target.value) })}
              className="flex-1 h-0.5 accent-zinc-400"
            />
            <span className="font-mono text-[11px] text-zinc-500 w-8 text-right">{td.fontSize}</span>
          </div>
        </div>
        <div>
          <Label>Weight</Label>
          <div className="flex items-center gap-1">
            <input
              type="range" min={100} max={900} step={100}
              value={fontWeight}
              onChange={(e) => setFontWeight(Number(e.target.value))}
              className="flex-1 h-0.5 accent-zinc-400"
            />
            <span className="font-mono text-[11px] text-zinc-500 w-8 text-right">{fontWeight}</span>
          </div>
        </div>
      </div>

      {/* Color */}
      <div className="px-3 pb-2">
        <Label>Color</Label>
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1.5 focus-within:border-zinc-600 transition-colors">
          <input
            type="color"
            value={td.fill}
            onChange={(e) => onText({ fill: e.target.value, fillGradient: undefined })}
            className="w-5 h-5 bg-transparent border-0 cursor-pointer flex-none rounded"
          />
          <input
            type="text"
            value={td.fill}
            onChange={(e) => onText({ fill: e.target.value, fillGradient: undefined })}
            className="flex-1 bg-transparent font-mono text-[12px] text-zinc-200 outline-none placeholder:text-zinc-600"
          />
        </div>
      </div>

      <Divider />

      {/* ── TEXT CONTENT: always open ── */}
      <div className="px-3 pt-2 pb-2">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500 mb-2">Content</div>
        <textarea
          value={td.text}
          onChange={(e) => onText({ text: e.target.value })}
          rows={3}
          className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-600 text-zinc-200 text-[12px] rounded-md px-2 py-1.5 outline-none resize-none transition-colors"
        />
      </div>

      <Divider />

      {/* ── TYPOGRAPHY: collapsible, default open ── */}
      <CollapsibleSection label="Typography" defaultOpen={true}>
        {/* Alignment */}
        <div className="px-3 pb-1">
          <Label>Align</Label>
          <div className="flex overflow-hidden rounded-md border border-zinc-800">
            {(["left", "center", "right", "justify"] as const).map((a, i) => {
              const labels: Record<string, string> = { left: "L", center: "C", right: "R", justify: "J" };
              const active = td.align === a;
              return (
                <button
                  key={a}
                  onClick={() => onText({ align: a })}
                  title={a}
                  className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
                    active ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60"
                  } ${i > 0 ? "border-l border-zinc-800" : ""}`}
                >
                  {labels[a]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Spacing + Leading in one row */}
        <div className="px-3 pb-1 grid grid-cols-2 gap-2">
          <div>
            <Label>Spacing</Label>
            <div className="flex items-center gap-1">
              <input
                type="range" min={-10} max={60}
                value={td.letterSpacing ?? 0}
                onChange={(e) => onText({ letterSpacing: Number(e.target.value) })}
                className="flex-1 h-0.5 accent-zinc-400"
              />
              <span className="font-mono text-[11px] text-zinc-500 w-6 text-right">{td.letterSpacing ?? 0}</span>
            </div>
          </div>
          <div>
            <Label>Leading</Label>
            <div className="flex items-center gap-1">
              <input
                type="range" min={0.7} max={3.5} step={0.05}
                value={td.lineHeight ?? 1.2}
                onChange={(e) => onText({ lineHeight: Number(e.target.value) })}
                className="flex-1 h-0.5 accent-zinc-400"
              />
              <span className="font-mono text-[11px] text-zinc-500 w-6 text-right">{(td.lineHeight ?? 1.2).toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Style + Orient + Case */}
        <div className="px-3 pb-2 grid grid-cols-3 gap-2">
          {/* Italic */}
          <div>
            <Label>Style</Label>
            <button
              onClick={() => setItalic(!italic)}
              className={`w-full py-1 text-[12px] italic rounded-md border transition-colors ${
                italic ? "border-zinc-500 text-zinc-200 bg-zinc-800" : "border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              I
            </button>
          </div>

          {/* Orient */}
          <div>
            <Label>Orient</Label>
            <div className="flex rounded-md border border-zinc-800 overflow-hidden">
              {(["horizontal", "vertical"] as const).map((mode, i) => {
                const active = (td.writingMode ?? "horizontal") === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => onText({ writingMode: mode })}
                    className={`flex-1 py-1 text-[11px] font-medium transition-colors ${
                      active ? "bg-zinc-700 text-zinc-100" : "text-zinc-600 hover:text-zinc-300"
                    } ${i > 0 ? "border-l border-zinc-800" : ""}`}
                  >
                    {mode === "horizontal" ? "H" : "V"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Case */}
          <div>
            <Label>Case</Label>
            <div className="flex rounded-md border border-zinc-800 overflow-hidden">
              {([
                { value: "uppercase" as const, label: "AA" },
                { value: "lowercase" as const, label: "aa" },
                { value: "none" as const,      label: "Aa" },
              ]).map(({ value, label }, i) => {
                const active = (td.textTransform ?? "none") === value;
                return (
                  <button
                    key={value}
                    onClick={() => onText({ textTransform: value })}
                    className={`flex-1 py-1 text-[10px] font-medium transition-colors ${
                      active ? "bg-zinc-700 text-zinc-100" : "text-zinc-600 hover:text-zinc-300"
                    } ${i > 0 ? "border-l border-zinc-800" : ""}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rotation */}
        {layer && onLayer && (
          <div className="px-3 pb-2">
            <Label>Rotation</Label>
            <div className="flex items-center gap-2">
              <input
                type="range" min={-180} max={180}
                value={layer.rotation}
                onChange={(e) => onLayer({ rotation: Number(e.target.value) })}
                className="flex-1 h-0.5 accent-zinc-400"
              />
              <input
                type="number"
                min={-180} max={180}
                value={Math.round(layer.rotation)}
                onChange={(e) => onLayer({ rotation: Number(e.target.value) })}
                className="w-12 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 font-mono text-[11px] text-zinc-200 outline-none focus:border-zinc-600 text-right"
              />
            </div>
            <div className="flex gap-1 mt-1">
              {([-90, 0, 45, 90] as const).map((deg) => (
                <button
                  key={deg}
                  onClick={() => onLayer({ rotation: deg })}
                  className="flex-1 text-[10px] font-medium py-0.5 border border-zinc-800 hover:border-zinc-600 text-zinc-600 hover:text-zinc-300 rounded transition-colors"
                >
                  {deg}°
                </button>
              ))}
            </div>
          </div>
        )}
      </CollapsibleSection>

      <Divider />

      {/* ── EFFECTS: collapsible, default closed ── */}
      <CollapsibleSection label="Effects" defaultOpen={false} badge="Advanced">
        {/* Effect toggles */}
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {EFFECTS.map((ef) => {
            const active = activeEffects.has(ef.id);
            return (
              <button
                key={ef.id}
                onClick={() => toggleEffect(ef.id)}
                title={ef.konvaSupported ? ef.label : `${ef.label} (not available)`}
                className={`text-[11px] font-medium px-2 py-1 rounded-md border transition-colors ${
                  active
                    ? "border-zinc-500 text-zinc-100 bg-zinc-800"
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                } ${!ef.konvaSupported ? "opacity-30 cursor-not-allowed" : ""}`}
              >
                {ef.label}
              </button>
            );
          })}
        </div>

        {/* Shadow controls */}
        {(activeEffects.has("shadow") || activeEffects.has("neon")) && (
          <div className="px-3 pb-2">
            <Label>Shadow</Label>
            {activeEffects.has("shadow") && (
              <>
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1.5 mb-1">
                  <input
                    type="color"
                    value={td.shadowColor ?? "#000000"}
                    onChange={(e) => onText({ shadowColor: e.target.value })}
                    className="w-4 h-4 bg-transparent border-0 cursor-pointer flex-none"
                  />
                  <input
                    type="text"
                    value={td.shadowColor ?? "#000000"}
                    onChange={(e) => onText({ shadowColor: e.target.value })}
                    className="flex-1 bg-transparent font-mono text-[12px] text-zinc-200 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 mb-1">
                  <div>
                    <Label>X</Label>
                    <input type="range" min={-28} max={28} value={td.shadowOffsetX ?? 4}
                      onChange={(e) => onText({ shadowOffsetX: Number(e.target.value) })}
                      className="w-full h-0.5 accent-zinc-400" />
                  </div>
                  <div>
                    <Label>Y</Label>
                    <input type="range" min={-28} max={28} value={td.shadowOffsetY ?? 4}
                      onChange={(e) => onText({ shadowOffsetY: Number(e.target.value) })}
                      className="w-full h-0.5 accent-zinc-400" />
                  </div>
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500 w-8">Blur</span>
              <input type="range" min={0} max={50} value={td.shadowBlur ?? 8}
                onChange={(e) => onText({ shadowBlur: Number(e.target.value) })}
                className="flex-1 h-0.5 accent-zinc-400" />
              <span className="font-mono text-[11px] text-zinc-500 w-8 text-right">{td.shadowBlur ?? 8}</span>
            </div>
          </div>
        )}

        {/* Outline controls */}
        {activeEffects.has("outline") && (
          <div className="px-3 pb-2">
            <Label>Outline</Label>
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1.5 mb-1">
              <input
                type="color"
                value={td.stroke ?? "#ffffff"}
                onChange={(e) => onText({ stroke: e.target.value })}
                className="w-4 h-4 bg-transparent border-0 cursor-pointer flex-none"
              />
              <input
                type="text"
                value={td.stroke ?? "#ffffff"}
                onChange={(e) => onText({ stroke: e.target.value })}
                className="flex-1 bg-transparent font-mono text-[12px] text-zinc-200 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500 w-8">Width</span>
              <input type="range" min={1} max={20} value={td.strokeWidth ?? 2}
                onChange={(e) => onText({ strokeWidth: Number(e.target.value) })}
                className="flex-1 h-0.5 accent-zinc-400" />
              <span className="font-mono text-[11px] text-zinc-500 w-8 text-right">{td.strokeWidth ?? 2}px</span>
            </div>
          </div>
        )}

        {/* Gradient fill */}
        <div className="px-3 pb-2">
          <Label>Gradient fill</Label>
          <div className="flex flex-wrap gap-1.5">
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
                  className={`w-8 h-5 rounded border transition-colors ${
                    active ? "border-zinc-400 scale-110" : "border-zinc-800 hover:border-zinc-600"
                  }`}
                  style={previewStyle}
                />
              );
            })}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── AI ASSIST: collapsible ── */}
      {onTypography && (
        <>
          <Divider />
          <CollapsibleSection label="AI Assist" defaultOpen={true}>
            {/* Primary 3 actions */}
            <div className="px-3 pb-2 grid grid-cols-3 gap-1.5">
              {[
                { label: "✨ Improve",  hint: "improve",    title: "Improve copy & style" },
                { label: "🎨 Style",    hint: "cinematic",  title: "Apply a new style" },
                { label: "⚡ Layout",   hint: "hierarchy",  title: "Fix type hierarchy" },
              ].map(({ label, hint, title }) => (
                <button
                  key={hint}
                  onClick={() => onTypography(hint)}
                  title={title}
                  className="py-1.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-100 border border-zinc-800 hover:border-zinc-600 rounded-md transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Secondary actions */}
            <div className="px-3 pb-2 flex flex-wrap gap-1">
              {[
                { label: "Editorial",   hint: "editorial" },
                { label: "Brutalist",   hint: "brutalist" },
                { label: "Experimental", hint: "experimental" },
                { label: "Fit canvas",  hint: "fit-to-canvas" },
                { label: "Match ref",   hint: "match-reference" },
                { label: "Distribute",  hint: "distribute" },
              ].map(({ label, hint }) => (
                <button
                  key={hint}
                  onClick={() => onTypography(hint)}
                  className="text-[10px] font-medium px-2 py-0.5 rounded border border-zinc-800 text-zinc-600 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </CollapsibleSection>
        </>
      )}
    </>
  );
}

// ─── Image inspector ───────────────────────────────────────────────────────────

function ImageInspector({ layer, onLayer, onEditImage, onCutout }: {
  layer: PosterLayer;
  onLayer: (u: Partial<PosterLayer>) => void;
  onEditImage?: (layerId: string) => void;
  onCutout?: (layerId: string) => void;
}) {
  const adj = layer.imageData?.adjustments;
  const hasAdj = adj && Object.values(adj).some((v) => v !== 0);
  return (
    <>
      <Divider />
      <div className="px-3 pt-1 pb-2">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500 mb-2">Image</div>
        <div className="flex gap-2 mb-2">
          {onEditImage && (
            <button
              onClick={() => onEditImage(layer.id)}
              className="flex-1 border border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-zinc-200 text-[12px] font-medium py-1.5 rounded-md transition-colors"
            >
              Edit image
            </button>
          )}
          {onCutout && (
            <button
              onClick={() => onCutout(layer.id)}
              className="flex-1 border border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-zinc-200 text-[12px] font-medium py-1.5 rounded-md transition-colors"
              title="Extract subject, lasso, or brush mask"
            >
              Cutout
            </button>
          )}
          {hasAdj && (
            <button
              onClick={() => onLayer({ imageData: { ...(layer.imageData ?? { src: "" }), adjustments: undefined } })}
              title="Reset adjustments"
              className="border border-zinc-800 hover:border-zinc-600 text-zinc-600 hover:text-red-400 font-mono text-[11px] px-2.5 py-1.5 rounded-md transition-colors"
            >
              ↺
            </button>
          )}
        </div>
        {hasAdj && (
          <div className="font-mono text-[10px] text-zinc-600 leading-relaxed">
            {Object.entries(adj!).filter(([, v]) => v !== 0).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join("  ")}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Gradient layer inspector ─────────────────────────────────────────────────

const GRADIENT_PRESETS_LAYER = [
  { label: "Violet Radial",  gradientType: "radial"  as const, stops: [{ offset: 0, color: "#6b21a8" }, { offset: 1, color: "rgba(0,0,0,0)" }], angle: 0 },
  { label: "Night Linear",   gradientType: "linear"  as const, stops: [{ offset: 0, color: "#0f172a" }, { offset: 1, color: "#1e1b4b" }], angle: 180 },
  { label: "Dusk",           gradientType: "linear"  as const, stops: [{ offset: 0, color: "#7c3aed" }, { offset: 0.5, color: "#db2777" }, { offset: 1, color: "#f59e0b" }], angle: 135 },
  { label: "Fog",            gradientType: "radial"  as const, stops: [{ offset: 0, color: "rgba(255,255,255,0.15)" }, { offset: 1, color: "rgba(255,255,255,0)" }], angle: 0 },
  { label: "Ember",          gradientType: "radial"  as const, stops: [{ offset: 0, color: "#dc2626" }, { offset: 0.6, color: "#7f1d1d" }, { offset: 1, color: "rgba(0,0,0,0)" }], angle: 0 },
  { label: "Sea",            gradientType: "linear"  as const, stops: [{ offset: 0, color: "#0c4a6e" }, { offset: 1, color: "#164e63" }], angle: 180 },
];

function GradientLayerInspector({ layer, onLayer }: {
  layer: PosterLayer;
  onLayer: (u: Partial<PosterLayer>) => void;
}) {
  const gd = layer.gradientData ?? {
    gradientType: "radial" as const,
    stops: [{ offset: 0, color: "#4a1d96" }, { offset: 1, color: "rgba(0,0,0,0)" }] as GradientColorStop[],
    angle: 0,
  };

  function set(updates: Partial<typeof gd>) {
    onLayer({ gradientData: { ...gd, ...updates } });
  }

  function setStop(index: number, updates: Partial<GradientColorStop>) {
    const stops = gd.stops.map((s, i) => i === index ? { ...s, ...updates } : s);
    set({ stops });
  }

  function addStop() {
    const stops = [...gd.stops, { offset: 0.5, color: "#ffffff" }].sort((a, b) => a.offset - b.offset);
    set({ stops });
  }

  function removeStop(index: number) {
    if (gd.stops.length <= 2) return;
    const stops = gd.stops.filter((_, i) => i !== index);
    set({ stops });
  }

  return (
    <>
      <Divider />
      <CollapsibleSection label="Gradient" defaultOpen={true}>
        {/* Presets */}
        <div className="px-3 pb-2 grid grid-cols-3 gap-1">
          {GRADIENT_PRESETS_LAYER.map((p) => {
            const css =
              p.gradientType === "radial"
                ? `radial-gradient(circle, ${p.stops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(", ")})`
                : `linear-gradient(${p.angle}deg, ${p.stops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(", ")})`;
            return (
              <button
                key={p.label}
                title={p.label}
                onClick={() => set({ gradientType: p.gradientType, stops: p.stops as GradientColorStop[], angle: p.angle })}
                className="h-7 rounded-md border border-zinc-800 hover:border-zinc-600 transition-colors overflow-hidden"
                style={{ background: css }}
              />
            );
          })}
        </div>

        {/* Type */}
        <div className="px-3 pb-1">
          <Label>Type</Label>
          <div className="flex rounded-md border border-zinc-800 overflow-hidden">
            {(["linear", "radial"] as const).map((t, i) => (
              <button
                key={t}
                onClick={() => set({ gradientType: t })}
                className={`flex-1 py-1 text-[11px] font-medium transition-colors ${
                  gd.gradientType === t ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                } ${i > 0 ? "border-l border-zinc-800" : ""}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {gd.gradientType === "linear" && (
          <SliderRow label="Angle" min={0} max={360} value={gd.angle} onChange={(v) => set({ angle: v })} display={`${gd.angle}°`} />
        )}

        {/* Color stops */}
        <div className="px-3 pb-2">
          <Label>Color stops</Label>
          <div className="space-y-2">
            {gd.stops.map((stop, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="color"
                  value={stop.color.startsWith("rgba") ? "#888888" : stop.color}
                  onChange={(e) => setStop(i, { color: e.target.value })}
                  className="w-5 h-5 bg-transparent border-0 cursor-pointer flex-none"
                />
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={stop.offset}
                  onChange={(e) => setStop(i, { offset: Number(e.target.value) })}
                  className="flex-1 h-0.5 accent-zinc-400"
                />
                <span className="font-mono text-[10px] text-zinc-600 w-7 text-right">{Math.round(stop.offset * 100)}%</span>
                <button
                  onClick={() => removeStop(i)}
                  disabled={gd.stops.length <= 2}
                  className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-20"
                >×</button>
              </div>
            ))}
            <button
              onClick={addStop}
              className="w-full py-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-300 transition-colors border border-zinc-800 hover:border-zinc-600 rounded-md"
            >
              + Add stop
            </button>
          </div>
        </div>
      </CollapsibleSection>
    </>
  );
}

// ─── Texture / grain inspector ─────────────────────────────────────────────────

function generateGrainSrc(width: number, height: number, intensity: number, scale: number): string {
  const s = Math.max(1, Math.round(scale));
  const w = Math.ceil(width / s);
  const h = Math.ceil(height / s);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(w, h);
  const alpha = Math.round((intensity / 100) * 255);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = alpha;
  }
  ctx.putImageData(img, 0, 0);
  if (s === 1) return canvas.toDataURL();
  const c2 = document.createElement("canvas");
  c2.width = width; c2.height = height;
  const ctx2 = c2.getContext("2d")!;
  ctx2.imageSmoothingEnabled = false;
  ctx2.drawImage(canvas, 0, 0, width, height);
  return c2.toDataURL();
}

function TextureLayerInspector({ layer, onLayer }: {
  layer: PosterLayer;
  onLayer: (u: Partial<PosterLayer>) => void;
}) {
  const nd = layer.noiseData ?? { intensity: 30, scale: 2 };
  const { project } = usePosterStore();

  function regenerate(intensity: number, scale: number) {
    if (!project) return;
    const src = generateGrainSrc(layer.width, layer.height, intensity, scale);
    onLayer({
      noiseData: { intensity, scale },
      imageData: { ...(layer.imageData ?? { src: "" }), src, fit: "fill" },
    });
  }

  return (
    <>
      <Divider />
      <CollapsibleSection label="Grain" defaultOpen={true}>
        <SliderRow label="Intensity" min={0} max={100} value={nd.intensity} onChange={(v) => regenerate(v, nd.scale)} display={`${nd.intensity}%`} />
        <SliderRow label="Scale" min={1} max={10} value={nd.scale} onChange={(v) => regenerate(nd.intensity, v)} display={`${nd.scale}px`} />
        <div className="px-3 pb-2">
          <button
            onClick={() => regenerate(nd.intensity, nd.scale)}
            className="w-full py-1.5 text-[12px] font-medium text-zinc-600 hover:text-zinc-300 transition-colors border border-zinc-800 hover:border-zinc-600 rounded-md"
          >
            Reseed grain
          </button>
        </div>
      </CollapsibleSection>
    </>
  );
}

// ─── Shape inspector ───────────────────────────────────────────────────────────

function ShapeInspector({ layer, onLayer }: {
  layer: PosterLayer;
  onLayer: (u: Partial<PosterLayer>) => void;
}) {
  const sd = layer.shapeData ?? { shapeType: "rect" as const, fill: "none", stroke: "#ffffff", strokeWidth: 1 };

  function set(updates: Partial<typeof sd>) {
    onLayer({ shapeData: { ...sd, ...updates } });
  }

  return (
    <>
      <Divider />
      <CollapsibleSection label="Shape" defaultOpen={true}>
        <div className="px-3 pb-2 space-y-2">
          <div>
            <Label>Fill</Label>
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1.5">
              <input type="color" value={sd.fill === "none" ? "#000000" : sd.fill}
                onChange={(e) => set({ fill: e.target.value })}
                className="w-4 h-4 bg-transparent border-0 cursor-pointer flex-none" />
              <input type="text" value={sd.fill} onChange={(e) => set({ fill: e.target.value })}
                className="flex-1 bg-transparent font-mono text-[12px] text-zinc-200 outline-none" placeholder="none" />
            </div>
          </div>
          <div>
            <Label>Stroke</Label>
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1.5">
              <input type="color" value={sd.stroke || "#ffffff"}
                onChange={(e) => set({ stroke: e.target.value })}
                className="w-4 h-4 bg-transparent border-0 cursor-pointer flex-none" />
              <input type="text" value={sd.stroke} onChange={(e) => set({ stroke: e.target.value })}
                className="flex-1 bg-transparent font-mono text-[12px] text-zinc-200 outline-none" />
            </div>
          </div>
          <SliderRow label="Width" min={0} max={20} value={sd.strokeWidth} onChange={(v) => set({ strokeWidth: v })} display={`${sd.strokeWidth}px`} />
        </div>
      </CollapsibleSection>
    </>
  );
}

// ─── Transform inspector ───────────────────────────────────────────────────────

function TransformInspector({ layer, onLayer }: {
  layer: PosterLayer;
  onLayer: (u: Partial<PosterLayer>) => void;
}) {
  return (
    <CollapsibleSection label="Transform" defaultOpen={false}>
      {/* Position + Size */}
      <div className="px-3 pb-2 grid grid-cols-2 gap-2">
        <NumberInput label="X" value={Math.round(layer.x)} onChange={(v) => onLayer({ x: v })} />
        <NumberInput label="Y" value={Math.round(layer.y)} onChange={(v) => onLayer({ y: v })} />
        <NumberInput label="W" value={Math.round(layer.width)} onChange={(v) => onLayer({ width: v })} />
        <NumberInput label="H" value={Math.round(layer.height)} onChange={(v) => onLayer({ height: v })} />
      </div>

      {/* Rotation */}
      <div className="px-3 pb-2">
        <Label>Rotation</Label>
        <div className="flex items-center gap-2 mb-1">
          <input
            type="range" min={-180} max={180}
            value={layer.rotation}
            onChange={(e) => onLayer({ rotation: Number(e.target.value) })}
            className="flex-1 h-0.5 accent-zinc-400"
          />
          <input
            type="number" min={-180} max={180}
            value={Math.round(layer.rotation)}
            onChange={(e) => onLayer({ rotation: Number(e.target.value) })}
            className="w-12 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 font-mono text-[11px] text-zinc-200 outline-none focus:border-zinc-600 text-right"
          />
        </div>
        <div className="flex gap-1">
          {([0, 90, -90] as const).map((deg) => (
            <button key={deg} onClick={() => onLayer({ rotation: deg })}
              className="flex-1 text-[10px] font-medium py-0.5 border border-zinc-800 hover:border-zinc-600 text-zinc-600 hover:text-zinc-300 rounded transition-colors">
              {deg}°
            </button>
          ))}
          <button onClick={() => onLayer({ rotation: 0 })} title="Reset"
            className="flex-1 text-[11px] font-medium py-0.5 border border-zinc-800 hover:border-zinc-600 text-zinc-600 hover:text-zinc-300 rounded transition-colors">
            ↺
          </button>
        </div>
      </div>

      {/* Opacity */}
      <SliderRow
        label="Opacity"
        min={0} max={1} step={0.01}
        value={layer.opacity}
        onChange={(v) => onLayer({ opacity: v })}
        display={`${Math.round(layer.opacity * 100)}%`}
      />

      {/* Blend mode */}
      <Row label="Blend">
        <select
          value={layer.blendMode ?? "normal"}
          onChange={(e) => onLayer({ blendMode: e.target.value as BlendMode })}
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-[12px] outline-none px-2 py-1 rounded-md"
        >
          {BLEND_MODES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </Row>

      {/* Z-index */}
      <Row label="Z-index">
        <input
          type="number"
          value={layer.zIndex}
          onChange={(e) => onLayer({ zIndex: Number(e.target.value) })}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 font-mono text-[12px] text-zinc-200 outline-none focus:border-zinc-600 transition-colors"
        />
      </Row>
      <div className="pb-2" />
    </CollapsibleSection>
  );
}
