"use client";
import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { usePosterStore } from "@/store/posterStore";
import type { ReferenceConfig, ReferenceAnalysis, AssetItem, PosterLayer } from "@/types/poster";
import { extractPaletteFromUrl } from "@/lib/colorExtract";

type TargetKey = keyof ReferenceConfig["targets"];

const TARGETS: { key: TargetKey; label: string }[] = [
  { key: "mood",            label: "Overall mood" },
  { key: "color",           label: "Color palette" },
  { key: "backgroundStyle", label: "Background style" },
  { key: "typography",      label: "Typography" },
  { key: "layout",          label: "Composition / layout" },
  { key: "texture",         label: "Texture / material" },
  { key: "lighting",        label: "Lighting" },
];

export function ReferencePanel() {
  const {
    reference,
    setReference,
    setReferenceImage,
    setReferencePalette,
    getSortedLayers,
    updateTextData,
    updateLayer,
    addLayer,
    addAsset,
    project,
  } = usePosterStore();

  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genToast, setGenToast] = useState("");
  const [generatedAssets, setGeneratedAssets] = useState<AssetItem[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!reference.imageUrl) {
      setExtracting(false);
      setAnalyzing(false);
      return;
    }
    setExtracting(true);
    setAnalyzing(true);

    const imageUrl = reference.imageUrl;

    Promise.all([
      extractPaletteFromUrl(imageUrl).catch(() => []),
      fetch("/api/analyze/reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      })
        .then(
          (r) =>
            r.json() as Promise<{
              analysis: ReferenceAnalysis | null;
              error?: string;
              demo?: boolean;
            }>,
        )
        .catch(() => ({ analysis: null as ReferenceAnalysis | null, error: "Network error", demo: undefined as boolean | undefined })),
    ]).then(([palette, analysisResult]) => {
      // Palette
      setReferencePalette(
        palette.length > 0 ? palette : [],
        palette.length === 0 ? "Could not extract palette from reference image" : "",
      );

      // Vision analysis
      const analysisError = analysisResult.demo
        ? "Vision analysis requires API key — using palette only"
        : (analysisResult.error ?? "");
      setReference({ analysis: analysisResult.analysis, analysisError });

      if (process.env.NODE_ENV !== "production") {
        console.log("[ReferencePanel] Analysis:", analysisResult.analysis);
        console.log("[ReferencePanel] Palette:", palette.map((p) => p.hex));
      }
    }).finally(() => {
      setExtracting(false);
      setAnalyzing(false);
    });
  }, [reference.imageUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setBusy(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        if (url) setReferenceImage(url);
        setBusy(false);
      };
      reader.onerror = () => setBusy(false);
      reader.readAsDataURL(file);
    },
    [setReferenceImage],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    disabled: busy,
  });

  function toggleTarget(key: TargetKey) {
    setReference({
      targets: { ...reference.targets, [key]: !reference.targets[key] },
    });
  }

  function applyPaletteToCanvas() {
    if (!project || reference.palette.length === 0) return;
    const { palette } = reference;
    const accentColor =
      palette.find((p) => p.role === "accent")?.hex ??
      palette.find((p) => p.role === "highlight")?.hex ??
      palette[1]?.hex ?? "#ffffff";
    const bodyColor =
      palette.find((p) => p.role === "highlight")?.hex ??
      palette[2]?.hex ?? "#aaaaaa";
    getSortedLayers()
      .filter((l) => l.type.endsWith("Text") && !l.locked && l.textData)
      .forEach((l) => {
        const isTitle = l.type === "titleText" || l.type === "userText";
        updateTextData(l.id, { fill: isTitle ? accentColor : bodyColor, fillGradient: undefined });
      });
  }

  async function generateFromReference() {
    if (!project) return;
    setGenLoading(true);
    setGenToast("");
    setGeneratedAssets([]);

    const anyTarget = Object.values(reference.targets).some(Boolean);
    if (!anyTarget) {
      setGenToast("⚠ No targets selected — select at least one target to apply reference.");
      setGenLoading(false);
      return;
    }

    const imagePrompt = project.promptHistory.at(-1) ?? "";
    const refCtx = {
      strength: reference.strength,
      targets: reference.targets,
      palette: reference.palette.length > 0 ? reference.palette : undefined,
      analysis: reference.analysis ?? undefined,
      instruction: reference.instruction || undefined,
    };

    if (process.env.NODE_ENV !== "production") {
      console.log("[ReferencePanel] generateFromReference context:", {
        strength: refCtx.strength,
        targets: refCtx.targets,
        hasAnalysis: !!refCtx.analysis,
        analysisSummary: refCtx.analysis?.visualSummary,
        paletteColors: refCtx.palette?.map((p) => p.hex),
      });
    }

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
          }).then((r) => r.json() as Promise<{ url?: string; demo?: boolean }>),
        ),
      );

      const newAssets: AssetItem[] = [];
      for (const { url } of results) {
        if (!url) continue;
        const asset: AssetItem = {
          id: crypto.randomUUID(),
          userId: "local",
          imageUrl: url,
          fileName: `ref-generated-${Date.now()}`,
          createdAt: new Date().toISOString(),
          generatedTag: "from reference",
        };
        addAsset(asset);
        newAssets.push(asset);
      }

      setGeneratedAssets(newAssets);
      const n = newAssets.length;
      setGenToast(n > 0 ? `${n} image${n > 1 ? "s" : ""} added to Assets` : "No images returned");
      setTimeout(() => setGenToast(""), 5000);
    } catch {
      setGenToast("Generation failed — check API key");
      setTimeout(() => setGenToast(""), 4000);
    } finally {
      setGenLoading(false);
    }
  }

  function applyToCanvas(asset: AssetItem, action: "background" | "layer") {
    if (!project) return;
    const canvas = project.canvas;
    const layers = getSortedLayers();

    if (action === "background") {
      const bgLayer = layers.find((l) => l.type === "backgroundImage");
      if (bgLayer) {
        updateLayer(bgLayer.id, { imageData: { src: asset.imageUrl, fit: "fill" } });
      } else {
        const newLayer: PosterLayer = {
          id: crypto.randomUUID(),
          type: "backgroundImage",
          label: "Background",
          x: 0, y: 0,
          width: canvas.width, height: canvas.height,
          rotation: 0, opacity: 1,
          visible: true, locked: false, zIndex: 1,
          imageData: { src: asset.imageUrl, fit: "fill" },
        };
        addLayer(newLayer);
      }
    } else {
      const userImgCount = layers.filter((l) => l.type === "userImage").length;
      const newLayer: PosterLayer = {
        id: crypto.randomUUID(),
        type: "userImage",
        label: `generated ${userImgCount + 1}`,
        x: Math.round(canvas.width * 0.05),
        y: Math.round(canvas.height * 0.05),
        width: Math.round(canvas.width * 0.9),
        height: Math.round(canvas.height * 0.9),
        rotation: 0, opacity: 1,
        visible: true, locked: false, zIndex: 0,
        imageData: { src: asset.imageUrl, fit: "contain" },
      };
      addLayer(newLayer);
    }
  }

  const hasReference = !!reference.imageUrl || reference.palette.length > 0;
  const noTargetsSelected = hasReference && !Object.values(reference.targets).some(Boolean);
  const analysisReady = !!reference.analysis;
  const analysisLoading = analyzing && !analysisReady;

  return (
    <div className="p-3 space-y-4">
      <div className="pt-1 font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-700">
        Reference Image
      </div>

      {/* Image preview / upload */}
      {reference.imageUrl ? (
        <div className="relative group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={reference.imageUrl}
            alt="reference"
            className="w-full aspect-square object-cover rounded-sm"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm flex items-center justify-center gap-2">
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <button
                className="font-mono text-[9px] tracking-wide uppercase text-zinc-200 px-2 py-1 transition-colors hover:bg-white/10 rounded-sm"
                style={{ border: "1px solid rgba(255,255,255,0.2)" }}
              >
                Replace
              </button>
            </div>
            <button
              onClick={() => {
                setReferenceImage(null);
                setReference({ analysis: null, analysisError: "" });
                setGeneratedAssets([]);
              }}
              className="font-mono text-[9px] tracking-wide uppercase text-zinc-500 px-2 py-1 transition-colors hover:text-red-400 rounded-sm"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className="rounded-sm py-8 text-center cursor-pointer transition-colors"
          style={{
            border: `1px dashed ${isDragActive ? "rgba(161,161,170,0.5)" : "rgba(255,255,255,0.1)"}`,
            background: isDragActive ? "rgba(255,255,255,0.03)" : "transparent",
          }}
        >
          <input {...getInputProps()} />
          <div className="space-y-1">
            <div className="text-zinc-600 text-xl leading-none">+</div>
            <div className="font-mono text-[9px] text-zinc-600 tracking-wide">
              {isDragActive ? "drop image" : "upload reference image"}
            </div>
          </div>
        </div>
      )}

      {/* Analysis status + palette */}
      {reference.imageUrl && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] tracking-[0.15em] uppercase text-zinc-600">
              {analysisLoading
                ? "Analyzing…"
                : analysisReady
                ? "Vision analysis ✓"
                : reference.analysisError
                ? "Palette only"
                : "Extracted palette"}
            </span>
            <div className="flex items-center gap-2">
              {(extracting || analyzing) && (
                <span className="font-mono text-[8px] text-zinc-700">
                  {extracting ? "extracting…" : ""}
                  {analyzing ? "analyzing…" : ""}
                </span>
              )}
              <button
                onClick={() => setShowDebug((v) => !v)}
                className="font-mono text-[8px] text-zinc-800 hover:text-zinc-600 transition-colors"
              >
                {showDebug ? "hide" : "debug"}
              </button>
            </div>
          </div>

          {/* Analysis error / warning */}
          {reference.analysisError && !analysisReady && (
            <p className="font-mono text-[8px] text-amber-600/70">{reference.analysisError}</p>
          )}

          {/* Palette swatches */}
          {reference.paletteError ? (
            <p className="font-mono text-[8px] text-red-500/70">{reference.paletteError}</p>
          ) : reference.palette.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1">
                {reference.palette.map((c) => (
                  <div
                    key={c.hex}
                    className="w-6 h-6 rounded-sm hover:scale-110 transition-transform"
                    style={{ background: c.hex, border: "1px solid rgba(255,255,255,0.12)" }}
                    title={`${c.hex} (${c.role})`}
                  />
                ))}
              </div>
              {project && (
                <button
                  onClick={applyPaletteToCanvas}
                  className="w-full font-mono text-[9px] tracking-wide uppercase py-1.5 transition-colors text-zinc-600 hover:text-zinc-200"
                  style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  Apply palette to text layers
                </button>
              )}
            </>
          ) : !extracting ? (
            <p className="font-mono text-[8px] text-zinc-700">no palette extracted yet</p>
          ) : null}

          {/* Debug panel */}
          {showDebug && (
            <div
              className="rounded-sm p-2 space-y-1 font-mono text-[8px] text-zinc-600"
              style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.4)" }}
            >
              <div>Strength: {reference.strength}% · Targets: {Object.entries(reference.targets).filter(([,v])=>v).map(([k])=>k).join(", ") || "none"}</div>
              {reference.palette.length > 0 && (
                <div>Palette: {reference.palette.map((p) => p.hex).join(", ")}</div>
              )}
              {reference.analysis ? (
                <>
                  <div className="text-zinc-500">── Vision analysis ──</div>
                  <div>Summary: {reference.analysis.visualSummary}</div>
                  <div>Mood: {reference.analysis.mood}</div>
                  <div>Composition: {reference.analysis.composition}</div>
                  <div>Shapes: {reference.analysis.shapes}</div>
                  <div>Texture: {reference.analysis.texture}</div>
                  <div>Lighting: {reference.analysis.lighting}</div>
                  <div>Typography: {reference.analysis.typographyStyle}</div>
                  <div>Colors: {reference.analysis.palette.join(", ")}</div>
                </>
              ) : (
                <div className="text-amber-600/70">
                  {reference.analysisError || "No analysis yet"}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Warning: image but no targets */}
      {noTargetsSelected && (
        <div className="flex items-center gap-2 font-mono text-[9px] text-amber-600/80">
          <span>⚠</span>
          <span>Reference not applied — select at least one target below</span>
        </div>
      )}

      {/* Strength slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] tracking-[0.15em] uppercase text-zinc-600">Strength</span>
          <span className="font-mono text-[9px] text-zinc-500">
            {reference.strength}
            {reference.strength >= 71 ? " — strict" : reference.strength >= 31 ? " — noticeable" : " — loose"}
          </span>
        </div>
        <input
          type="range"
          min={0} max={100}
          value={reference.strength}
          onChange={(e) => setReference({ strength: Number(e.target.value) })}
          className="w-full h-0.5 accent-zinc-400"
        />
      </div>

      {/* Target checkboxes */}
      <div className="space-y-1.5">
        <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-zinc-600">Apply to</div>
        <div className="space-y-1.5">
          {TARGETS.map(({ key, label }) => {
            const active = reference.targets[key];
            return (
              <button
                key={key}
                onClick={() => toggleTarget(key)}
                className="flex items-center gap-2 w-full group text-left"
              >
                <span
                  className="w-3 h-3 flex-none flex items-center justify-center text-[8px] transition-colors"
                  style={{
                    border: `1px solid ${active ? "rgba(161,161,170,0.6)" : "rgba(255,255,255,0.15)"}`,
                    background: active ? "rgba(255,255,255,0.08)" : "transparent",
                    color: active ? "#e4e4e7" : "transparent",
                  }}
                >✓</span>
                <span
                  className="font-mono text-[9px] transition-colors"
                  style={{ color: active ? "#a1a1aa" : "#52525b" }}
                >
                  {label}
                  {key === "color" && reference.palette.length > 0 && (
                    <span className="ml-1 text-zinc-600">({reference.palette.length} colors)</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom instruction */}
      <div className="space-y-1.5">
        <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-zinc-600">Instruction</div>
        <textarea
          value={reference.instruction}
          onChange={(e) => setReference({ instruction: e.target.value })}
          placeholder="e.g. Use only the color palette, ignore composition…"
          rows={3}
          className="w-full bg-transparent text-zinc-300 font-mono text-[9px] leading-relaxed outline-none p-2 placeholder:text-zinc-700 resize-none transition-colors rounded-sm"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        />
      </div>

      {/* ── Generate from Reference CTA ──────────────────────────────────── */}
      {project && (
        <div
          className="pt-2 space-y-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            onClick={generateFromReference}
            disabled={genLoading || !hasReference}
            className="w-full py-2.5 font-mono text-[9px] tracking-[0.15em] uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: genLoading ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: genLoading ? "#71717a" : "#e4e4e7",
            }}
          >
            {genLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-2.5 h-2.5 border border-zinc-600 border-t-zinc-300 rounded-full animate-spin inline-block" />
                generating 2 variations…
              </span>
            ) : (
              `Generate Image from Reference${analysisReady ? " ✓" : ""} →`
            )}
          </button>

          {!hasReference && (
            <p className="font-mono text-[8px] text-zinc-700 text-center">
              Upload a reference image or set targets to enable
            </p>
          )}

          {/* Toast */}
          {genToast && (
            <p className="font-mono text-[9px] text-zinc-400 text-center">{genToast}</p>
          )}
        </div>
      )}

      {/* ── Generated results ─────────────────────────────────────────────── */}
      {generatedAssets.length > 0 && (
        <div className="space-y-3">
          <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-zinc-600">
            Generated — choose an action
          </div>

          {generatedAssets.map((asset, i) => (
            <div key={asset.id} className="space-y-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.imageUrl}
                alt={`variation ${i + 1}`}
                className="w-full rounded-sm"
                style={{ border: "1px solid rgba(255,255,255,0.08)", aspectRatio: `${project?.canvas.width ?? 1}/${project?.canvas.height ?? 1}`, objectFit: "cover" }}
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => applyToCanvas(asset, "background")}
                  className="flex-1 py-1.5 font-mono text-[9px] tracking-wide uppercase transition-colors text-zinc-400 hover:text-zinc-100"
                  style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  Set Background
                </button>
                <button
                  onClick={() => applyToCanvas(asset, "layer")}
                  className="flex-1 py-1.5 font-mono text-[9px] tracking-wide uppercase transition-colors text-zinc-400 hover:text-zinc-100"
                  style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  Add as Layer
                </button>
              </div>
            </div>
          ))}

          <p className="font-mono text-[8px] text-zinc-700 text-center">
            Also saved in Assets tab · no automatic canvas change
          </p>
        </div>
      )}

      {!reference.imageUrl && generatedAssets.length === 0 && (
        <p className="font-mono text-[8px] text-zinc-700 text-center pt-1">
          Upload a reference image — vision analysis will run automatically
        </p>
      )}
    </div>
  );
}
