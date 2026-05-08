"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { v4 as uuidv4 } from "uuid";
import { usePosterStore } from "@/store/posterStore";
import { RECIPE_LIST } from "@/lib/styleRecipes";
import { extractPaletteFromUrl } from "@/lib/colorExtract";
import type { PaletteColor } from "@/lib/colorExtract";
import type { ReferenceAnalysis } from "@/types/poster";
import type {
  PosterType,
  Language,
  StyleRecipe,
  CanvasSize,
  ImageSource,
  ImageStyle,
  PosterSetupConfig,
  PosterProject,
} from "@/types/poster";

interface RefImage {
  id: string;
  url: string;
  palette: PaletteColor[];
  analysis: ReferenceAnalysis | null;
  analysisError: string;
}

type Setter = (p: Partial<PosterSetupConfig>) => void;

const IMAGE_STYLES: { value: ImageStyle; label: string }[] = [
  { value: "cinematic-photography", label: "Cinematic" },
  { value: "abstract",              label: "Abstract" },
  { value: "collage",               label: "Collage" },
  { value: "minimal-graphic",       label: "Minimal" },
  { value: "painterly",             label: "Painterly" },
  { value: "custom",                label: "Custom…" },
];

const CANVAS_OPTIONS: { value: CanvasSize; label: string; dim: string }[] = [
  { value: "a4",             label: "A4",      dim: "794 × 1123" },
  { value: "a3",             label: "A3",      dim: "1123 × 1587" },
  { value: "instagram-post", label: "Square",  dim: "1080 × 1080" },
  { value: "instagram-story",label: "Story",   dim: "1080 × 1920" },
  { value: "custom",         label: "Custom",  dim: "" },
];

const REF_TARGET_OPTIONS: { key: keyof RefTargets; label: string }[] = [
  { key: "mood",            label: "Mood" },
  { key: "color",           label: "Color" },
  { key: "layout",          label: "Composition" },
  { key: "backgroundStyle", label: "Background" },
  { key: "typography",      label: "Typography" },
  { key: "texture",         label: "Texture" },
  { key: "lighting",        label: "Lighting" },
];

interface RefTargets {
  mood: boolean;
  color: boolean;
  layout: boolean;
  backgroundStyle: boolean;
  typography: boolean;
  texture: boolean;
  lighting: boolean;
}

export function PromptComposer() {
  const { setProject } = usePosterStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [cfg, setCfg] = useState<PosterSetupConfig>({
    posterType:   "poster",
    canvasSize:   "a4",
    language:     "en",
    styleRecipe:  "cinematic-rain",
    imageSource:  "generate",
    imageStyle:   "cinematic-photography",
    prompt:       "",
    aiWriteCopy:  false,
  });

  const [refImages, setRefImages] = useState<RefImage[]>([]);
  const [refStrength, setRefStrength] = useState(55);
  const [refTargets, setRefTargets] = useState<RefTargets>({
    mood: true, color: true, layout: false,
    backgroundStyle: false, typography: false, texture: false, lighting: false,
  });
  const [refExtracting, setRefExtracting] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const set: Setter = (p) => setCfg((c) => ({ ...c, ...p }));

  const onRefDrop = useCallback(async (files: File[]) => {
    setRefExtracting(true);
    for (const file of files) {
      const url = await new Promise<string>((res) => {
        const reader = new FileReader();
        reader.onload = (e) => res((e.target?.result as string) ?? "");
        reader.readAsDataURL(file);
      });
      if (!url) continue;

      // Run palette extraction and vision analysis in parallel
      const [palette, analysisResult] = await Promise.all([
        extractPaletteFromUrl(url).catch(() => [] as PaletteColor[]),
        fetch("/api/analyze/reference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: url }),
        })
          .then((r) => r.json() as Promise<{ analysis: ReferenceAnalysis | null; error?: string; demo?: boolean }>)
          .catch(() => ({ analysis: null as ReferenceAnalysis | null, error: "Network error", demo: undefined as boolean | undefined })),
      ]);

      if (process.env.NODE_ENV !== "production") {
        console.log("[PromptComposer] Reference analysis:", analysisResult.analysis);
        console.log("[PromptComposer] Palette:", palette.map((p) => p.hex));
      }

      setRefImages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          url,
          palette,
          analysis: analysisResult.analysis,
          analysisError: analysisResult.demo
            ? "Vision analysis requires API key — using palette only"
            : (analysisResult.error ?? ""),
        },
      ]);
    }
    setRefExtracting(false);
  }, []);

  const { getRootProps: getRefRootProps, getInputProps: getRefInputProps, isDragActive: isRefDragActive } = useDropzone({
    onDrop: onRefDrop,
    accept: { "image/*": [] },
    disabled: busy || refExtracting,
  });

  function removeRefImage(id: string) {
    setRefImages((prev) => prev.filter((r) => r.id !== id));
  }

  function buildRefCtx() {
    if (refImages.length === 0) return undefined;

    // Merge palettes from all reference images, deduplicate by Euclidean distance
    const merged: PaletteColor[] = [];
    for (const img of refImages) {
      for (const color of img.palette) {
        const r = parseInt(color.hex.slice(1, 3), 16);
        const g = parseInt(color.hex.slice(3, 5), 16);
        const b = parseInt(color.hex.slice(5, 7), 16);
        if (
          merged.length < 8 &&
          merged.every((s) => {
            const sr = parseInt(s.hex.slice(1, 3), 16);
            const sg = parseInt(s.hex.slice(3, 5), 16);
            const sb = parseInt(s.hex.slice(5, 7), 16);
            return Math.sqrt((r - sr) ** 2 + (g - sg) ** 2 + (b - sb) ** 2) > 45;
          })
        ) {
          merged.push(color);
        }
      }
    }

    // Use first image's analysis (most recent single-image reference is most reliable)
    const analysis = refImages[0]?.analysis ?? null;

    return {
      strength: refStrength,
      targets: refTargets,
      palette: merged,
      analysis,
      instruction: `${refImages.length} reference image${refImages.length > 1 ? "s" : ""} provided`,
    };
  }

  const noTargetsSelected = refImages.length > 0 && !Object.values(refTargets).some(Boolean);
  const analysisAvailable = refImages.some((r) => r.analysis !== null);

  async function generate() {
    setBusy(true);
    setError("");
    const refCtx = buildRefCtx();

    if (process.env.NODE_ENV !== "production" && refCtx) {
      console.log("[PromptComposer] Reference context sent to generation:", {
        strength: refCtx.strength,
        targets: refCtx.targets,
        paletteColors: refCtx.palette.map((p) => p.hex),
        hasAnalysis: !!refCtx.analysis,
        analysisSummary: refCtx.analysis?.visualSummary,
      });
    }

    try {
      const layoutRes = await fetch("/api/generate/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup: cfg, lockedLayers: [], reference: refCtx }),
      });
      if (!layoutRes.ok) throw new Error();
      const { layers, canvas, imagePrompt, demo: layoutDemo } = await layoutRes.json();

      let finalLayers = layers;

      if (cfg.imageSource === "generate") {
        const imgRes = await fetch("/api/generate/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: imagePrompt,
            styleRecipe: cfg.styleRecipe,
            imageStyle: cfg.imageStyle,
            customImagePrompt: cfg.customImagePrompt,
            width: canvas.width,
            height: canvas.height,
            reference: refCtx,
          }),
        });
        const { url } = await imgRes.json();
        if (url) {
          finalLayers = layers.map((l: { type: string; imageData?: Record<string, unknown> }) =>
            l.type === "backgroundImage"
              ? { ...l, imageData: { ...l.imageData, src: url } }
              : l,
          );
        }
      }

      const now = new Date().toISOString();
      const project: PosterProject = {
        id:            uuidv4(),
        userId:        "local",
        title:         cfg.userTitle || cfg.prompt || "Untitled",
        canvas,
        layers:        finalLayers,
        styleRecipe:   cfg.styleRecipe,
        posterType:    cfg.posterType,
        language:      cfg.language,
        promptHistory: [cfg.prompt],
        lockedLayers:  [],
        isDemo:        !!layoutDemo,
        createdAt:     now,
        updatedAt:     now,
      };
      setProject(project);
    } catch {
      setError("Generation failed. Check your API key or try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Wordmark */}
      <div className="px-8 pt-8">
        <span className="font-mono text-xs tracking-[0.2em] text-zinc-600 uppercase">
          poster agent
        </span>
      </div>

      {/* Main composer */}
      <div className="flex-1 flex items-start justify-center px-8 pt-16 pb-24">
        <div className="w-full max-w-xl space-y-10">

          {/* Prompt */}
          <div className="space-y-2">
            <label className="block font-mono text-[10px] tracking-[0.2em] text-zinc-600 uppercase">
              What are we making?
            </label>
            <textarea
              value={cfg.prompt}
              onChange={(e) => set({ prompt: e.target.value })}
              placeholder="Describe the concept, mood, or subject…"
              rows={3}
              className="w-full bg-transparent border-b border-zinc-800 focus:border-zinc-500 outline-none text-zinc-100 text-sm resize-none pb-2 placeholder:text-zinc-700 transition-colors"
            />
          </div>

          {/* Style recipes */}
          <div className="space-y-3">
            <label className="block font-mono text-[10px] tracking-[0.2em] text-zinc-600 uppercase">
              Style
            </label>
            <div className="flex flex-wrap gap-2">
              {RECIPE_LIST.map((r) => (
                <Chip
                  key={r.id}
                  active={cfg.styleRecipe === r.id}
                  onClick={() => set({ styleRecipe: r.id as StyleRecipe })}
                >
                  {r.name}
                </Chip>
              ))}
            </div>
          </div>

          {/* Image source */}
          <div className="space-y-3">
            <label className="block font-mono text-[10px] tracking-[0.2em] text-zinc-600 uppercase">
              Image
            </label>
            <div className="flex gap-2">
              {(["generate", "upload", "reference"] as ImageSource[]).map((s) => (
                <Chip key={s} active={cfg.imageSource === s} onClick={() => set({ imageSource: s })}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Chip>
              ))}
            </div>

            {cfg.imageSource === "generate" && (
              <div className="flex flex-wrap gap-2 pt-1">
                {IMAGE_STYLES.map((s) => (
                  <Chip
                    key={s.value}
                    active={cfg.imageStyle === s.value}
                    onClick={() => set({ imageStyle: s.value })}
                    small
                  >
                    {s.label}
                  </Chip>
                ))}
              </div>
            )}

            {cfg.imageSource === "generate" && cfg.imageStyle === "custom" && (
              <input
                type="text"
                value={cfg.customImagePrompt ?? ""}
                onChange={(e) => set({ customImagePrompt: e.target.value })}
                placeholder="Describe the image style…"
                className="w-full bg-transparent border-b border-zinc-800 focus:border-zinc-500 outline-none text-zinc-200 text-xs pb-1.5 placeholder:text-zinc-700 transition-colors"
              />
            )}
          </div>

          {/* Reference images */}
          <div className="space-y-3">
            <label className="block font-mono text-[10px] tracking-[0.2em] text-zinc-600 uppercase">
              Reference Images
              <span className="text-zinc-800 normal-case tracking-normal font-sans ml-1">— optional</span>
            </label>

            <div
              {...getRefRootProps()}
              className={`py-4 text-center border border-dashed transition-colors cursor-pointer ${
                isRefDragActive
                  ? "border-zinc-500 bg-zinc-900/50"
                  : "border-zinc-900 hover:border-zinc-700"
              }`}
            >
              <input {...getRefInputProps()} />
              <span className="font-mono text-[10px] text-zinc-700">
                {refExtracting
                  ? "analyzing…"
                  : isRefDragActive
                  ? "drop"
                  : "drop images here, or click to browse"}
              </span>
            </div>

            {/* Warning: image uploaded but no targets selected */}
            {noTargetsSelected && (
              <div className="flex items-center gap-2 font-mono text-[9px] text-amber-600/80">
                <span>⚠</span>
                <span>Reference image not applied — select at least one target below</span>
              </div>
            )}

            {refImages.length > 0 && (
              <>
                <div className="flex gap-1.5 flex-wrap">
                  {refImages.map((img) => (
                    <div key={img.id} className="relative group w-14 h-14 flex-none">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt="reference"
                        className="w-full h-full object-cover rounded-sm"
                        style={{ border: "1px solid rgba(255,255,255,0.07)" }}
                      />
                      {/* Analysis status badge */}
                      <span
                        className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full"
                        style={{
                          background: img.analysis ? "#4ade80" : img.analysisError ? "#f59e0b" : "#52525b",
                        }}
                        title={img.analysis ? "Vision analysis complete" : (img.analysisError || "Analyzing…")}
                      />
                      <button
                        onClick={() => removeRefImage(img.id)}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-800 text-zinc-400 font-mono text-[9px] items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex"
                      >×</button>
                      {img.palette.length > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 flex">
                          {img.palette.slice(0, 5).map((c, i) => (
                            <div key={i} className="flex-1 h-1" style={{ background: c.hex }} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Analysis status line */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] text-zinc-700">
                    {analysisAvailable
                      ? `● Vision analysis complete — ${Object.values(refTargets).filter(Boolean).length} target${Object.values(refTargets).filter(Boolean).length !== 1 ? "s" : ""} active`
                      : refImages[0]?.analysisError
                      ? `⚠ ${refImages[0].analysisError}`
                      : "Analyzing…"}
                  </span>
                  <button
                    onClick={() => setShowDebug((v) => !v)}
                    className="font-mono text-[8px] text-zinc-800 hover:text-zinc-600 transition-colors"
                  >
                    {showDebug ? "hide debug" : "debug"}
                  </button>
                </div>

                {/* Debug panel */}
                {showDebug && (
                  <div
                    className="rounded-sm p-2 space-y-1.5 font-mono text-[8px] text-zinc-600"
                    style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.4)" }}
                  >
                    <div>Images: {refImages.length} · Strength: {refStrength}%</div>
                    <div>Targets: {Object.entries(refTargets).filter(([,v])=>v).map(([k])=>k).join(", ") || "none"}</div>
                    {refImages[0]?.palette.length > 0 && (
                      <div>Palette: {refImages[0].palette.map((p) => p.hex).join(", ")}</div>
                    )}
                    {refImages[0]?.analysis && (
                      <>
                        <div className="text-zinc-500">── Vision analysis ──</div>
                        <div>Summary: {refImages[0].analysis.visualSummary}</div>
                        <div>Mood: {refImages[0].analysis.mood}</div>
                        <div>Composition: {refImages[0].analysis.composition}</div>
                        <div>Shapes: {refImages[0].analysis.shapes}</div>
                        <div>Texture: {refImages[0].analysis.texture}</div>
                        <div>Lighting: {refImages[0].analysis.lighting}</div>
                        <div>Typography: {refImages[0].analysis.typographyStyle}</div>
                        <div>Colors: {refImages[0].analysis.palette.join(", ")}</div>
                      </>
                    )}
                    {refImages[0]?.analysisError && (
                      <div className="text-amber-600/70">⚠ {refImages[0].analysisError}</div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-[9px] text-zinc-600 uppercase tracking-[0.15em]">Influence</label>
                    <span className="font-mono text-[9px] text-zinc-500">
                      {refStrength}%
                      {refStrength >= 71 ? " strict" : refStrength >= 31 ? " noticeable" : " loose"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0} max={100}
                    value={refStrength}
                    onChange={(e) => setRefStrength(Number(e.target.value))}
                    className="w-full cursor-pointer"
                    style={{ accentColor: "#a1a1aa" }}
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {REF_TARGET_OPTIONS.map((t) => (
                    <Chip
                      key={t.key}
                      active={refTargets[t.key]}
                      onClick={() => setRefTargets((prev) => ({ ...prev, [t.key]: !prev[t.key] }))}
                      small
                    >
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Row: language + canvas */}
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="block font-mono text-[10px] tracking-[0.2em] text-zinc-600 uppercase">
                Language
              </label>
              <div className="flex gap-2">
                {([["en","EN"],["zh","中文"],["mixed","Bilingual"]] as [Language,string][]).map(([v, l]) => (
                  <Chip key={v} active={cfg.language === v} onClick={() => set({ language: v })} small>
                    {l}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block font-mono text-[10px] tracking-[0.2em] text-zinc-600 uppercase">
                Canvas
              </label>
              <div className="flex flex-wrap gap-2">
                {CANVAS_OPTIONS.map((o) => (
                  <Chip
                    key={o.value}
                    active={cfg.canvasSize === o.value}
                    onClick={() => set({ canvasSize: o.value })}
                    small
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          {/* Custom canvas */}
          {cfg.canvasSize === "custom" && (
            <div className="flex gap-6">
              <div>
                <label className="font-mono text-[10px] tracking-widest text-zinc-600">Width px</label>
                <input type="number" value={cfg.customWidth ?? 800}
                  onChange={(e) => set({ customWidth: Number(e.target.value) })}
                  className="block w-24 mt-1 bg-transparent border-b border-zinc-800 text-zinc-200 text-xs outline-none pb-1" />
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-widest text-zinc-600">Height px</label>
                <input type="number" value={cfg.customHeight ?? 1200}
                  onChange={(e) => set({ customHeight: Number(e.target.value) })}
                  className="block w-24 mt-1 bg-transparent border-b border-zinc-800 text-zinc-200 text-xs outline-none pb-1" />
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-zinc-900" />

          {/* Copy toggle + user text */}
          <div className="space-y-4">
            <button
              onClick={() => set({ aiWriteCopy: !cfg.aiWriteCopy })}
              className="flex items-center gap-3 group"
            >
              <span className={`w-4 h-4 border flex items-center justify-center text-[10px] transition-colors ${cfg.aiWriteCopy ? "border-zinc-400 text-zinc-200" : "border-zinc-700 text-transparent"}`}>
                ✓
              </span>
              <span className="font-mono text-[10px] tracking-[0.15em] text-zinc-500 uppercase group-hover:text-zinc-400 transition-colors">
                Let AI write poster copy
              </span>
            </button>

            {!cfg.aiWriteCopy && (
              <div className="space-y-3 pl-7">
                {[
                  { key: "userTitle",       ph: "Title" },
                  { key: "userSubtitle",    ph: "Subtitle / tagline" },
                  { key: "userDateLocation",ph: "Date · Venue" },
                  { key: "userCredits",     ph: "Credits" },
                ].map(({ key, ph }) => (
                  <input
                    key={key}
                    type="text"
                    value={(cfg as unknown as Record<string, string>)[key] ?? ""}
                    onChange={(e) => set({ [key]: e.target.value } as Partial<PosterSetupConfig>)}
                    placeholder={ph}
                    className="block w-full bg-transparent border-b border-zinc-900 focus:border-zinc-700 text-zinc-300 text-xs outline-none pb-1.5 placeholder:text-zinc-700 transition-colors"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="font-mono text-xs text-red-500/80">{error}</p>
          )}

          {/* Generate */}
          <div className="flex justify-end pt-2">
            <button
              onClick={generate}
              disabled={busy}
              className="flex items-center gap-3 text-sm font-medium text-zinc-100 hover:text-white disabled:opacity-30 transition-colors group"
            >
              {busy ? (
                <>
                  <span className="w-3 h-3 border border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
                  <span className="font-mono text-xs tracking-widest text-zinc-500">Generating…</span>
                </>
              ) : (
                <>
                  <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-zinc-500 group-hover:text-zinc-400 transition-colors">Generate poster</span>
                  <span className="text-zinc-400 group-hover:translate-x-0.5 transition-transform">→</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────


function Chip({
  children, active, onClick, small,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`border px-3 transition-colors font-mono tracking-wide uppercase ${
        small ? "py-1 text-[10px]" : "py-1.5 text-[11px]"
      } ${
        active
          ? "border-zinc-400 text-zinc-100 bg-zinc-900"
          : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400"
      }`}
    >
      {children}
    </button>
  );
}
