"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { v4 as uuidv4 } from "uuid";
import { usePosterStore } from "@/store/posterStore";
import type {
  ReferenceConfig,
  ReferenceImage,
  ReferenceMode,
  ReferenceRole,
  ReferenceAnalysis,
  ReferenceTargets,
  PosterLayer,
} from "@/types/poster";
import { extractPaletteFromUrl } from "@/lib/colorExtract";
import { getAutoForbiddenTerms } from "@/lib/referencePrompt";

type TargetKey = keyof ReferenceTargets;

const TARGETS: { key: TargetKey; label: string }[] = [
  { key: "mood",            label: "Mood" },
  { key: "color",           label: "Color" },
  { key: "backgroundStyle", label: "Background" },
  { key: "layout",          label: "Composition" },
  { key: "typography",      label: "Typography" },
  { key: "texture",         label: "Texture" },
  { key: "lighting",        label: "Lighting" },
];

const MODES: { value: ReferenceMode; label: string; hint: string }[] = [
  { value: "loose",    label: "Loose",    hint: "Soft inspiration — mood and atmosphere only" },
  { value: "balanced", label: "Balanced", hint: "Strong influence — palette + partial structure" },
  { value: "strict",   label: "Strict",   hint: "Exact constraints — composition, palette, hierarchy MUST match" },
];

const ROLES: { value: ReferenceRole; label: string }[] = [
  { value: "primary",   label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "accent",    label: "Accent" },
];

async function analyzeImage(imageUrl: string): Promise<{
  palette: import("@/lib/colorExtract").PaletteColor[];
  analysis: ReferenceAnalysis | null;
  analysisError: string;
}> {
  const [palette, analysisResult] = await Promise.all([
    extractPaletteFromUrl(imageUrl).catch(() => []),
    fetch("/api/analyze/reference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
    })
      .then((r) => r.json() as Promise<{ analysis: ReferenceAnalysis | null; error?: string; demo?: boolean }>)
      .catch(() => ({ analysis: null as ReferenceAnalysis | null, error: "Network error", demo: undefined as boolean | undefined })),
  ]);

  const analysisError = analysisResult.demo
    ? "Vision analysis requires API key — palette only"
    : (analysisResult.error ?? "");

  return { palette, analysis: analysisResult.analysis, analysisError };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      if (url) resolve(url);
      else reject(new Error("empty result"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ── Analysis debug section ────────────────────────────────────────────────────

function AnalysisDebug({ image }: { image: ReferenceImage }) {
  const a = image.analysis;
  if (!a && image.palette.length === 0) return null;

  const forbidden = getAutoForbiddenTerms({
    strength: image.strength,
    targets: {},
    palette: image.palette.length > 0 ? image.palette : undefined,
    analysis: a,
  });

  return (
    <div
      className="mx-2 mb-2 rounded-sm space-y-1.5 text-[7px] font-mono"
      style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.15)", padding: "6px 8px" }}
    >
      <div className="text-zinc-600 uppercase tracking-widest text-[6px]">debug · analysis</div>

      {/* Palette */}
      {image.palette.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-zinc-700 w-14 flex-none">palette</span>
          <div className="flex gap-0.5 flex-wrap">
            {image.palette.map((c) => (
              <div
                key={c.hex}
                className="w-3.5 h-3.5 rounded-sm"
                title={`${c.hex} (${c.role})`}
                style={{ background: c.hex, border: "1px solid rgba(255,255,255,0.1)" }}
              />
            ))}
          </div>
          <span className="text-zinc-700">{image.palette.map((p) => p.hex).join(" ")}</span>
        </div>
      )}

      {/* Brightness + Contrast + Style Class */}
      {a && (
        <>
          <div className="flex gap-3">
            <span><span className="text-zinc-700">bright </span><span className="text-zinc-400">{a.brightness ?? "—"}</span></span>
            <span><span className="text-zinc-700">contrast </span><span className="text-zinc-400">{a.contrast ?? "—"}</span></span>
          </div>
          <div>
            <span className="text-zinc-700">style </span>
            <span className="text-zinc-400">{a.styleClass ?? "—"}</span>
          </div>
          {a.visualSummary && (
            <div>
              <span className="text-zinc-700">summary </span>
              <span className="text-zinc-500 italic">"{a.visualSummary}"</span>
            </div>
          )}
        </>
      )}

      {/* Forbidden terms */}
      {forbidden.length > 0 && (
        <div>
          <div className="text-zinc-700 mb-0.5">auto-forbidden</div>
          <div className="text-red-500/60 leading-relaxed">
            {forbidden.map((f, i) => (
              <span key={i} className="inline-block mr-1">— {f}</span>
            ))}
          </div>
        </div>
      )}

      {/* GPT forbiddenDrift */}
      {a?.forbiddenDrift && a.forbiddenDrift.length > 0 && (
        <div>
          <div className="text-zinc-700 mb-0.5">gpt forbidden drift</div>
          <div className="text-amber-600/60 leading-relaxed">
            {a.forbiddenDrift.map((f, i) => (
              <span key={i} className="inline-block mr-1">— {f}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Image card ────────────────────────────────────────────────────────────────

function RefImageCard({
  image,
  index,
  onUpdate,
  onRemove,
}: {
  image: ReferenceImage;
  index: number;
  onUpdate: (updates: Partial<ReferenceImage>) => void;
  onRemove: () => void;
}) {
  const [showDebug, setShowDebug] = useState(false);

  return (
    <div
      className="rounded-sm overflow-hidden"
      style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
    >
      {/* Thumbnail row */}
      <div className="flex gap-2 p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.imageUrl}
          alt={`ref ${index + 1}`}
          className="w-14 h-14 object-cover flex-none rounded-sm"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}
        />

        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Mode selector */}
          <div className="flex gap-0.5">
            {MODES.map((m) => (
              <button
                key={m.value}
                title={m.hint}
                onClick={() => onUpdate({ mode: m.value })}
                className="flex-1 py-0.5 font-mono text-[8px] uppercase tracking-wide transition-colors rounded-sm"
                style={{
                  background: image.mode === m.value ? "rgba(255,255,255,0.10)" : "transparent",
                  border: `1px solid ${image.mode === m.value ? "rgba(161,161,170,0.4)" : "rgba(255,255,255,0.07)"}`,
                  color: image.mode === m.value ? "#e4e4e7" : "#52525b",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Role + strength */}
          <div className="flex items-center gap-2">
            <select
              value={image.role}
              onChange={(e) => onUpdate({ role: e.target.value as ReferenceRole })}
              className="bg-transparent font-mono text-[8px] text-zinc-500 outline-none cursor-pointer hover:text-zinc-300 transition-colors"
              style={{ border: "none" }}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value} className="bg-zinc-900">
                  {r.label}
                </option>
              ))}
            </select>
            <span className="font-mono text-[8px] text-zinc-700 ml-auto">{image.strength}%</span>
          </div>

          {/* Strength slider */}
          <input
            type="range"
            min={0}
            max={100}
            value={image.strength}
            onChange={(e) => onUpdate({ strength: Number(e.target.value) })}
            className="w-full h-0.5 accent-zinc-400"
          />

          {/* Analysis status + debug toggle */}
          <div className="flex items-center justify-between">
            <span
              className="font-mono text-[7px] tracking-wide"
              style={{
                color: image.analyzing
                  ? "#71717a"
                  : image.analysis
                  ? "#4ade80"
                  : image.analysisError
                  ? "#f59e0b"
                  : "#3f3f46",
              }}
            >
              {image.analyzing
                ? "analyzing…"
                : image.analysis
                ? "vision ✓"
                : image.analysisError
                ? "palette only"
                : image.palette.length > 0
                ? `${image.palette.length} colors`
                : ""}
            </span>

            {(image.palette.length > 0 || image.analysis) && (
              <button
                onClick={() => setShowDebug((v) => !v)}
                className="font-mono text-[7px] transition-colors"
                style={{ color: showDebug ? "#a1a1aa" : "#3f3f46" }}
              >
                {showDebug ? "hide debug" : "debug"}
              </button>
            )}
          </div>
        </div>

        {/* Remove */}
        <button
          onClick={onRemove}
          className="flex-none font-mono text-[12px] text-zinc-700 hover:text-red-400 transition-colors self-start pt-0.5 leading-none"
          title="Remove"
        >
          ×
        </button>
      </div>

      {/* Debug panel (collapsible) */}
      {showDebug && <AnalysisDebug image={image} />}

      {/* Strict mode warning */}
      {image.mode === "strict" && !image.analysis && !image.analyzing && (
        <div
          className="mx-2 mb-2 px-2 py-1 font-mono text-[7px] text-amber-600/80 rounded-sm"
          style={{ border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.04)" }}
        >
          Add API key for vision analysis — strict mode is most effective with visual analysis
        </div>
      )}
    </div>
  );
}

// ── Add-image dropzone ────────────────────────────────────────────────────────

function AddImageZone({
  onAdd,
  disabled,
  compact,
}: {
  onAdd: (files: File[]) => void;
  disabled: boolean;
  compact?: boolean;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onAdd,
    accept: { "image/*": [] },
    maxFiles: 5,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      className="rounded-sm text-center cursor-pointer transition-colors"
      style={{
        border: `1px dashed ${isDragActive ? "rgba(161,161,170,0.5)" : "rgba(255,255,255,0.1)"}`,
        background: isDragActive ? "rgba(255,255,255,0.03)" : "transparent",
        padding: compact ? "8px" : "20px 12px",
      }}
    >
      <input {...getInputProps()} />
      <div className="space-y-1">
        <div className="text-zinc-600 text-base leading-none">+</div>
        <div className="font-mono text-[8px] text-zinc-700 tracking-wide">
          {isDragActive ? "drop images" : compact ? "add image" : "drop up to 5 reference images"}
        </div>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function ReferencePanel() {
  const {
    reference,
    setReference,
    addReferenceImage,
    removeReferenceImage,
    updateReferenceImage,
    getSortedLayers,
    updateTextData,
    updateLayer,
    addLayer,
    addAsset,
    project,
  } = usePosterStore();

  const [genLoading, setGenLoading]         = useState(false);
  const [genToast, setGenToast]             = useState("");
  const [adding, setAdding]                 = useState(false);
  const [promptPreview, setPromptPreview]   = useState<string | null>(null);
  const [showPrompt, setShowPrompt]         = useState(false);
  const [graphicLoading, setGraphicLoading] = useState(false);

  const images = reference.images;
  const hasImages = images.length > 0;
  const anyTarget = Object.values(reference.targets).some(Boolean);
  const noTargetsWarning = hasImages && !anyTarget;

  // ── Drop handler ──────────────────────────────────────────────────────────

  const handleDrop = useCallback(
    async (files: File[]) => {
      if (adding) return;
      setAdding(true);
      const remaining = 5 - images.length;
      const toAdd = files.slice(0, Math.max(0, remaining));

      await Promise.all(
        toAdd.map(async (file) => {
          let url: string;
          try {
            url = await readFileAsDataUrl(file);
          } catch {
            return;
          }

          const existingCount = images.length;
          const role: ReferenceRole =
            existingCount === 0 ? "primary" : existingCount === 1 ? "secondary" : "accent";

          const id = uuidv4();
          const newImage: ReferenceImage = {
            id,
            imageUrl: url,
            label: file.name,
            mode: existingCount === 0 ? "balanced" : "loose",
            role,
            strength: existingCount === 0 ? 70 : 40,
            palette: [],
            paletteError: "",
            analysis: null,
            analysisError: "",
            analyzing: true,
          };

          addReferenceImage(newImage);

          analyzeImage(url)
            .then(({ palette, analysis, analysisError }) => {
              updateReferenceImage(id, { palette, analysis, analysisError, analyzing: false });
            })
            .catch(() => {
              updateReferenceImage(id, { analyzing: false, analysisError: "Analysis failed" });
            });
        }),
      );

      setAdding(false);
    },
    [images, adding, addReferenceImage, updateReferenceImage],
  );

  // ── Apply palette to text layers ──────────────────────────────────────────

  function applyPaletteToCanvas() {
    if (!project) return;
    const primary = images.find((i) => i.role === "primary") ?? images[0];
    if (!primary || primary.palette.length === 0) return;
    const { palette } = primary;
    const accentColor =
      palette.find((p) => p.role === "accent")?.hex ??
      palette.find((p) => p.role === "highlight")?.hex ??
      palette[1]?.hex ?? "#ffffff";
    const bodyColor =
      palette.find((p) => p.role === "highlight")?.hex ?? palette[2]?.hex ?? "#aaaaaa";
    getSortedLayers()
      .filter((l) => l.type.endsWith("Text") && !l.locked && l.textData)
      .forEach((l) => {
        const isTitle = l.type === "titleText" || l.type === "userText";
        updateTextData(l.id, { fill: isTitle ? accentColor : bodyColor, fillGradient: undefined });
      });
  }

  // ── Generate images from reference ───────────────────────────────────────

  async function generateFromReference(matchMode?: "max") {
    if (!project || !hasImages) return;
    if (!anyTarget && matchMode !== "max") {
      setGenToast("Select at least one target to apply reference.");
      return;
    }

    setGenLoading(true);
    setGenToast("");
    setPromptPreview(null);

    // "Match Reference More" forces strict mode + all targets + full strength
    const refForGeneration = matchMode === "max"
      ? {
          ...reference,
          targets: { mood: true, color: true, backgroundStyle: true, typography: false, layout: true, texture: true, lighting: true },
          images: reference.images.map((img) => ({ ...img, mode: "strict" as ReferenceMode, strength: 100 })),
        }
      : reference;

    const refCtx = buildEditorRefCtx(refForGeneration);
    const imagePrompt = project.promptHistory.at(-1) ?? "";

    try {
      const results = await Promise.all(
        [1, 2].map(() =>
          fetch("/api/generate/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: imagePrompt,
              styleRecipe: project.styleRecipe,
              width: project.canvas.width,
              height: project.canvas.height,
              reference: refCtx,
            }),
          }).then((r) => r.json() as Promise<{ url?: string; promptPreview?: string }>),
        ),
      );

      // Capture prompt preview from first result
      const preview = results[0]?.promptPreview;
      if (preview) {
        setPromptPreview(preview);
        setShowPrompt(false);
      }

      let added = 0;
      for (const { url } of results) {
        if (!url) continue;
        const asset = {
          id: uuidv4(),
          userId: "local",
          imageUrl: url,
          fileName: `ref-gen-${Date.now()}`,
          createdAt: new Date().toISOString(),
          generatedTag: matchMode === "max" ? "match-max" : "from reference",
        };
        addAsset(asset);

        if (added === 0) {
          const layers = getSortedLayers();
          const bgLayer = layers.find((l) => l.type === "backgroundImage");
          if (bgLayer) {
            updateLayer(bgLayer.id, { imageData: { src: url, fit: "fill" } });
          } else {
            const canvas = project.canvas;
            const newLayer: PosterLayer = {
              id: uuidv4(),
              type: "backgroundImage",
              label: "Background",
              x: 0, y: 0,
              width: canvas.width, height: canvas.height,
              rotation: 0, opacity: 1,
              visible: true, locked: false, zIndex: 1,
              imageData: { src: url, fit: "fill" },
            };
            addLayer(newLayer);
          }
        }
        added++;
      }

      setGenToast(added > 0 ? `${added} image${added > 1 ? "s" : ""} generated` : "No images returned");
      setTimeout(() => setGenToast(""), 4000);
    } catch {
      setGenToast("Generation failed — check API key");
      setTimeout(() => setGenToast(""), 4000);
    } finally {
      setGenLoading(false);
    }
  }

  // ── Generate Graphic Match (SVG fallback) ─────────────────────────────────

  async function generateGraphicMatch() {
    if (!project || !hasImages) return;
    const primary = images.find((i) => i.role === "primary") ?? images[0];
    if (!primary || primary.palette.length === 0) {
      setGenToast("Need palette — wait for analysis to finish");
      return;
    }

    setGraphicLoading(true);
    setGenToast("");

    try {
      const res = await fetch("/api/generate/graphic-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          palette: primary.palette,
          width: project.canvas.width,
          height: project.canvas.height,
          styleClass: primary.analysis?.styleClass,
        }),
      }).then((r) => r.json() as Promise<{ url?: string }>);

      if (!res.url) throw new Error("No URL returned");

      const asset = {
        id: uuidv4(),
        userId: "local",
        imageUrl: res.url,
        fileName: `graphic-match-${Date.now()}`,
        createdAt: new Date().toISOString(),
        generatedTag: "graphic match",
      };
      addAsset(asset);

      const layers = getSortedLayers();
      const bgLayer = layers.find((l) => l.type === "backgroundImage");
      if (bgLayer) {
        updateLayer(bgLayer.id, { imageData: { src: res.url, fit: "fill" } });
      } else {
        const canvas = project.canvas;
        const newLayer: PosterLayer = {
          id: uuidv4(),
          type: "backgroundImage",
          label: "Background",
          x: 0, y: 0,
          width: canvas.width, height: canvas.height,
          rotation: 0, opacity: 1,
          visible: true, locked: false, zIndex: 1,
          imageData: { src: res.url, fit: "fill" },
        };
        addLayer(newLayer);
      }

      setGenToast("Graphic match applied to background");
      setTimeout(() => setGenToast(""), 4000);
    } catch {
      setGenToast("Graphic match failed");
      setTimeout(() => setGenToast(""), 4000);
    } finally {
      setGraphicLoading(false);
    }
  }

  function toggleTarget(key: TargetKey) {
    setReference({ targets: { ...reference.targets, [key]: !reference.targets[key] } });
  }

  const hasPalette      = images.some((i) => i.palette.length > 0);
  const strictCount     = images.filter((i) => i.mode === "strict").length;
  const hasAnalysis     = images.some((i) => i.analysis !== null);

  return (
    <div className="p-3 space-y-4">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-1">
        <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-600">Reference</span>
        {images.length > 0 && (
          <span className="font-mono text-[8px] text-zinc-700">
            {images.length}/5 images
            {strictCount > 0 && <span className="text-amber-600/70 ml-1">· {strictCount} strict</span>}
          </span>
        )}
      </div>

      {/* ── Image cards ────────────────────────────────────────────────────── */}
      {images.length > 0 && (
        <div className="space-y-2">
          {images.map((img, i) => (
            <RefImageCard
              key={img.id}
              image={img}
              index={i}
              onUpdate={(updates) => updateReferenceImage(img.id, updates)}
              onRemove={() => removeReferenceImage(img.id)}
            />
          ))}
        </div>
      )}

      {/* ── Add zone ────────────────────────────────────────────────────────── */}
      {images.length < 5 && (
        <AddImageZone
          onAdd={handleDrop}
          disabled={adding}
          compact={images.length > 0}
        />
      )}

      {images.length === 0 && (
        <p className="font-mono text-[8px] text-zinc-700 text-center pt-1">
          Upload 1–5 images · vision analysis runs automatically
        </p>
      )}

      {/* ── No targets warning ─────────────────────────────────────────────── */}
      {noTargetsWarning && (
        <div
          className="flex items-center gap-2 px-2 py-1.5 rounded-sm font-mono text-[8px] text-amber-600/80"
          style={{ border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.03)" }}
        >
          <span>⚠</span>
          <span>Select at least one target below to apply reference to generation</span>
        </div>
      )}

      {/* ── Global targets ──────────────────────────────────────────────────── */}
      {hasImages && (
        <div className="space-y-2">
          <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-zinc-600">Apply to</div>
          <div className="grid grid-cols-2 gap-1">
            {TARGETS.map(({ key, label }) => {
              const active = reference.targets[key];
              return (
                <button
                  key={key}
                  onClick={() => toggleTarget(key)}
                  className="flex items-center gap-1.5 text-left py-0.5"
                >
                  <span
                    className="w-2.5 h-2.5 flex-none flex items-center justify-center text-[7px] transition-colors rounded-sm"
                    style={{
                      border: `1px solid ${active ? "rgba(161,161,170,0.5)" : "rgba(255,255,255,0.12)"}`,
                      background: active ? "rgba(255,255,255,0.08)" : "transparent",
                      color: active ? "#e4e4e7" : "transparent",
                    }}
                  >
                    ✓
                  </span>
                  <span
                    className="font-mono text-[8px] transition-colors"
                    style={{ color: active ? "#a1a1aa" : "#52525b" }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Apply palette to text */}
          {hasPalette && project && (
            <button
              onClick={applyPaletteToCanvas}
              className="w-full py-1.5 font-mono text-[8px] tracking-wide uppercase transition-colors text-zinc-600 hover:text-zinc-200 rounded-sm"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Apply primary palette to text layers
            </button>
          )}
        </div>
      )}

      {/* ── Global instruction ──────────────────────────────────────────────── */}
      {hasImages && (
        <div className="space-y-1.5">
          <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-zinc-600">Instruction</div>
          <textarea
            value={reference.globalInstruction || reference.instruction}
            onChange={(e) => setReference({ globalInstruction: e.target.value, instruction: e.target.value })}
            placeholder="e.g. Use only the color palette, keep composition loose…"
            rows={2}
            className="w-full bg-transparent text-zinc-300 font-mono text-[9px] leading-relaxed outline-none p-2 placeholder:text-zinc-700 resize-none rounded-sm"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          />
        </div>
      )}

      {/* ── Generate CTAs ────────────────────────────────────────────────────── */}
      {project && hasImages && (
        <div className="space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px" }}>

          {/* Primary generate button */}
          <button
            onClick={() => generateFromReference()}
            disabled={genLoading || graphicLoading || !hasImages}
            className="w-full py-2.5 font-mono text-[9px] tracking-[0.15em] uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed rounded-sm"
            style={{
              background: genLoading ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: genLoading ? "#71717a" : "#e4e4e7",
            }}
          >
            {genLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 border border-zinc-600 border-t-zinc-300 rounded-full animate-spin inline-block" />
                generating…
              </span>
            ) : (
              "Generate from Reference →"
            )}
          </button>

          {/* Match Reference More button */}
          {hasAnalysis && (
            <button
              onClick={() => generateFromReference("max")}
              disabled={genLoading || graphicLoading}
              className="w-full py-2 font-mono text-[8px] tracking-[0.12em] uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed rounded-sm"
              style={{
                background: "rgba(251,191,36,0.04)",
                border: "1px solid rgba(251,191,36,0.20)",
                color: genLoading ? "#71717a" : "#fbbf24",
              }}
              title="Regenerates at strength 100 + strict mode + all visual targets enabled"
            >
              Match Reference More →
            </button>
          )}

          {/* Generate Graphic Match (SVG fallback) */}
          {hasPalette && (
            <button
              onClick={generateGraphicMatch}
              disabled={genLoading || graphicLoading}
              className="w-full py-2 font-mono text-[8px] tracking-[0.12em] uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed rounded-sm"
              style={{
                background: graphicLoading ? "rgba(255,255,255,0.02)" : "transparent",
                border: "1px solid rgba(255,255,255,0.07)",
                color: graphicLoading ? "#52525b" : "#71717a",
              }}
              title="Generates a blurred abstract SVG directly from the extracted palette — always matches reference colors and style"
            >
              {graphicLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-1.5 h-1.5 border border-zinc-700 border-t-zinc-400 rounded-full animate-spin inline-block" />
                  building…
                </span>
              ) : (
                "Generate Graphic Match →"
              )}
            </button>
          )}

          {/* Toast */}
          {genToast && (
            <p className="font-mono text-[8px] text-zinc-400 text-center">{genToast}</p>
          )}

          {/* Prompt preview (returned after generation) */}
          {promptPreview && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "8px" }}>
              <button
                onClick={() => setShowPrompt((v) => !v)}
                className="w-full text-left font-mono text-[7px] text-zinc-700 hover:text-zinc-500 transition-colors pb-1"
              >
                {showPrompt ? "▲ hide prompt sent to model" : "▼ show prompt sent to model"}
              </button>
              {showPrompt && (
                <pre
                  className="font-mono text-[7px] text-zinc-600 whitespace-pre-wrap leading-relaxed overflow-auto"
                  style={{ maxHeight: "200px", border: "1px solid rgba(255,255,255,0.04)", padding: "6px", borderRadius: "2px" }}
                >
                  {promptPreview}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

// ── Helper: build EditorRefCtx from store reference state ─────────────────────

export function buildEditorRefCtx(reference: ReferenceConfig) {
  if (reference.images.length > 0) {
    return {
      strength: 50,
      targets: reference.targets,
      globalInstruction: reference.globalInstruction || reference.instruction || undefined,
      references: reference.images.map((img) => ({
        id: img.id,
        mode: img.mode,
        role: img.role,
        strength: img.strength,
        targets: reference.targets,
        palette: img.palette.length > 0 ? img.palette : undefined,
        analysis: img.analysis ?? undefined,
      })),
    };
  }
  // Legacy single-ref fallback
  return {
    strength: reference.strength,
    targets: reference.targets,
    instruction: reference.instruction || undefined,
    palette: reference.palette.length > 0 ? reference.palette : undefined,
    analysis: reference.analysis ?? undefined,
  };
}
