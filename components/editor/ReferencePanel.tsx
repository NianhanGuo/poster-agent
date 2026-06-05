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

const TARGETS: { key: TargetKey; label: string; icon: string }[] = [
  { key: "mood",            label: "Mood",        icon: "◐" },
  { key: "color",           label: "Color",       icon: "●" },
  { key: "backgroundStyle", label: "Background",  icon: "□" },
  { key: "layout",          label: "Composition", icon: "⊞" },
  { key: "typography",      label: "Typography",  icon: "T" },
  { key: "texture",         label: "Texture",     icon: "⣿" },
  { key: "lighting",        label: "Lighting",    icon: "◑" },
];

const MODES: { value: ReferenceMode; label: string; hint: string }[] = [
  { value: "loose",    label: "Loose",    hint: "Soft inspiration — mood and atmosphere only" },
  { value: "balanced", label: "Balanced", hint: "Strong influence — palette + partial structure" },
  { value: "strict",   label: "Strict",   hint: "Exact match — composition, palette, hierarchy MUST match" },
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

// ── Structured analysis insight row ──────────────────────────────────────────

function InsightRow({ label, value }: { label: string; value: string }) {
  if (!value || value === "no text visible") return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] font-semibold text-zinc-600 w-20 flex-none pt-0.5 uppercase tracking-wide">{label}</span>
      <span className="text-[11px] text-zinc-400 leading-relaxed flex-1 min-w-0">{value}</span>
    </div>
  );
}

// ── Analysis Insights Card ────────────────────────────────────────────────────

function AnalysisInsights({ image }: { image: ReferenceImage }) {
  const a = image.analysis;
  const hasPalette = image.palette.length > 0;
  if (!a && !hasPalette) return null;

  return (
    <div className="space-y-3">

      {/* Visual summary quote */}
      {a?.visualSummary && (
        <p className="text-[11px] text-zinc-400 italic leading-relaxed border-l-2 border-zinc-700 pl-2.5">
          &ldquo;{a.visualSummary}&rdquo;
        </p>
      )}

      {/* ── Color palette ──── */}
      {(hasPalette || (a?.palette && a.palette.length > 0)) && (
        <div>
          <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-1.5">Color palette</div>
          <div className="flex gap-1 flex-wrap items-center">
            {image.palette.map((c) => (
              <div key={c.hex} title={`${c.hex} (${c.role})`}
                className="w-6 h-6 rounded flex-none border border-zinc-900/80"
                style={{ background: c.hex }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-2 mt-1">
            {image.palette.map((c) => (
              <span key={c.hex} className="font-mono text-[9px] text-zinc-600">{c.hex}</span>
            ))}
          </div>
          {a?.palette && a.palette.length > 0 && (
            <div className="text-[9px] text-zinc-700 font-mono mt-0.5">
              vision: {a.palette.join("  ")}
            </div>
          )}
        </div>
      )}

      {/* ── Poster genre ──── */}
      <div className="flex items-center gap-2">
        {a?.styleClass && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700/60">
            {a.styleClass}
          </span>
        )}
        {a?.brightness && (
          <span className="text-[10px] text-zinc-600 font-mono">{a.brightness}</span>
        )}
        {a?.contrast && (
          <span className="text-[10px] text-zinc-600 font-mono">{a.contrast} contrast</span>
        )}
      </div>

      {/* ── Structured fields ──── */}
      <div className="space-y-1.5">
        <InsightRow label="Mood"        value={a?.mood ?? ""} />
        <InsightRow label="Composition" value={a?.composition ?? ""} />
        <InsightRow label="Typography"  value={a?.typographyStyle ?? ""} />
        <InsightRow label="Geometry"    value={a?.shapes ?? ""} />
        <InsightRow label="Blur map"    value={a?.blurMap ?? ""} />
        <InsightRow label="Texture"     value={a?.texture ?? ""} />
        <InsightRow label="Lighting"    value={a?.lighting ?? ""} />
      </div>

      {/* ── Typography extract (structured) ──── */}
      {a?.typographyExtract && (
        <div>
          <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-1.5">Typography system</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {(Object.entries(a.typographyExtract) as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className="text-[9px] text-zinc-700 font-mono w-14 flex-none">{k}</span>
                <span className="text-[10px] text-zinc-500">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Rules to follow ──── */}
      {a?.rulesToFollow && a.rulesToFollow.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-1.5">Rules to follow</div>
          <ul className="space-y-1">
            {a.rulesToFollow.map((rule, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-green-500/70 text-[10px] flex-none mt-0.5">✓</span>
                <span className="text-[11px] text-zinc-400 leading-snug">{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Rules to avoid ──── */}
      {a?.forbiddenDrift && a.forbiddenDrift.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-1.5">Rules to avoid</div>
          <ul className="space-y-1">
            {a.forbiddenDrift.map((rule, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-red-500/60 text-[10px] flex-none mt-0.5">✗</span>
                <span className="text-[11px] text-zinc-500 leading-snug">{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Debug section (hidden by default) ─────────────────────────────────────────

function AnalysisDebug({ image }: { image: ReferenceImage }) {
  const a = image.analysis;
  if (!a && image.palette.length === 0) return null;

  const forbidden = getAutoForbiddenTerms({
    strength: image.strength,
    targets: { mood: false, color: false, backgroundStyle: false, typography: false, layout: false, texture: false, lighting: false },
    palette: image.palette.length > 0 ? image.palette : undefined,
    analysis: a,
  });

  return (
    <div className="rounded-md space-y-1 text-[9px] font-mono bg-zinc-950 border border-zinc-800/60 px-2.5 py-2 mt-2">
      <div className="text-zinc-700 uppercase tracking-widest text-[8px] mb-1">debug · analysis output</div>
      {a && (
        <>
          {a.brightness !== undefined && (
            <div><span className="text-zinc-700">bright </span><span className="text-zinc-500">{a.brightness}</span>
              <span className="text-zinc-700 ml-3">contrast </span><span className="text-zinc-500">{a.contrast ?? "—"}</span>
            </div>
          )}
          {a.composition && <div><span className="text-zinc-700">composition </span><span className="text-zinc-500">{a.composition}</span></div>}
          {a.blurMap && <div><span className="text-zinc-700">blur map </span><span className="text-zinc-500">{a.blurMap}</span></div>}
        </>
      )}
      {forbidden.length > 0 && (
        <div>
          <div className="text-zinc-700 mb-0.5">auto-forbidden</div>
          <div className="text-red-400/60">{forbidden.map((f, i) => <span key={i} className="mr-1.5">— {f}</span>)}</div>
        </div>
      )}
      {a?.forbiddenDrift && a.forbiddenDrift.length > 0 && (
        <div>
          <div className="text-zinc-700 mb-0.5">gpt forbidden drift</div>
          <div className="text-amber-500/60">{a.forbiddenDrift.map((f, i) => <span key={i} className="mr-1.5">— {f}</span>)}</div>
        </div>
      )}
    </div>
  );
}

// ── Poster Thumbnail Card ─────────────────────────────────────────────────────

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
  const [expanded, setExpanded] = useState(true); // default open so user can verify extraction
  const [showDebug, setShowDebug] = useState(false);
  const analysisReady = !image.analyzing && (image.analysis !== null || image.palette.length > 0);

  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800/60 bg-zinc-900/40">

      {/* Top: thumbnail + primary controls */}
      <div className="flex gap-3 p-3">

        {/* Poster thumbnail — taller aspect ratio */}
        <div className="flex-none relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.imageUrl}
            alt={`Reference ${index + 1}`}
            className="w-16 rounded-lg object-cover border border-zinc-800/60"
            style={{ aspectRatio: "3/4", objectPosition: "center top" }}
          />
          {/* Scanning overlay while analyzing */}
          {image.analyzing && (
            <div className="absolute inset-0 rounded-lg bg-zinc-950/70 flex flex-col items-center justify-center gap-1">
              <span className="w-3 h-3 rounded-full border-2 border-zinc-600 border-t-zinc-200 animate-spin block" />
              <span className="text-[8px] font-medium text-zinc-400">Analyzing</span>
            </div>
          )}
          {/* Done checkmark */}
          {analysisReady && !image.analyzing && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-800 border border-zinc-600 flex items-center justify-center">
              <span className="text-[8px] text-green-400">✓</span>
            </div>
          )}
          {/* Index badge */}
          <div className="absolute bottom-1 left-1 text-[8px] font-bold text-zinc-400 bg-zinc-950/80 rounded px-1">
            {index + 1}
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex-1 min-w-0 space-y-2">

          {/* Analysis status line */}
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-medium ${
              image.analyzing ? "text-zinc-500" :
              analysisReady   ? "text-green-400/80" :
              image.analysisError ? "text-amber-400/70" :
              "text-zinc-600"
            }`}>
              {image.analyzing
                ? "Scanning poster…"
                : image.analysis
                ? "Style analyzed ✓"
                : image.analysisError
                ? "Palette extracted"
                : image.palette.length > 0
                ? `${image.palette.length} colors found`
                : "Processing…"}
            </span>
            <button
              onClick={onRemove}
              className="text-zinc-700 hover:text-red-400 transition-colors text-[16px] leading-none"
              title="Remove"
            >
              ×
            </button>
          </div>

          {/* Mode selector */}
          <div>
            <div className="text-[10px] font-medium text-zinc-600 mb-1">Influence strength</div>
            <div className="flex gap-1">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  title={m.hint}
                  onClick={() => onUpdate({ mode: m.value })}
                  className={`flex-1 py-1 text-[10px] font-medium rounded-md transition-colors border ${
                    image.mode === m.value
                      ? "bg-zinc-700 border-zinc-600 text-zinc-100"
                      : "bg-transparent border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Role selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-zinc-600">Role</span>
            <div className="flex gap-1">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => onUpdate({ role: r.value })}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors border ${
                    image.role === r.value
                      ? "bg-zinc-700 border-zinc-600 text-zinc-200"
                      : "border-zinc-800 text-zinc-600 hover:text-zinc-400"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Strength fine-tune */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-zinc-600">Fine-tune</span>
              <span className="font-mono text-[10px] text-zinc-500">{image.strength}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={image.strength}
              onChange={(e) => onUpdate({ strength: Number(e.target.value) })}
              className="w-full h-0.5 accent-zinc-400"
            />
          </div>
        </div>
      </div>

      {/* Analysis insights (expand when ready) */}
      {analysisReady && (
        <>
          <div className="border-t border-zinc-800/60 px-3 py-2">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center justify-between w-full"
            >
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                Extracted insights
              </span>
              <span className={`text-zinc-700 text-[9px] transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}>
                ▶
              </span>
            </button>

            {expanded && (
              <div className="mt-2 space-y-3">
                <AnalysisInsights image={image} />

                {/* Debug toggle */}
                <button
                  onClick={() => setShowDebug((v) => !v)}
                  className="text-[9px] font-mono text-zinc-700 hover:text-zinc-500 transition-colors"
                >
                  {showDebug ? "hide debug" : "show debug output"}
                </button>
                {showDebug && <AnalysisDebug image={image} />}
              </div>
            )}
          </div>
        </>
      )}

      {/* Strict mode warning */}
      {image.mode === "strict" && !image.analysis && !image.analyzing && (
        <div className="mx-3 mb-3 px-2.5 py-1.5 text-[10px] font-medium text-amber-500/80 rounded-lg border border-amber-500/20 bg-amber-500/5">
          ⚠ Add API key for vision analysis — strict mode works best with full analysis
        </div>
      )}
    </div>
  );
}

// ── Upload zone ───────────────────────────────────────────────────────────────

function UploadZone({
  onAdd,
  disabled,
  hasImages,
  remaining,
}: {
  onAdd: (files: File[]) => void;
  disabled: boolean;
  hasImages: boolean;
  remaining: number;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onAdd,
    accept: { "image/*": [] },
    maxFiles: remaining,
    disabled,
  });

  if (hasImages) {
    return (
      <div
        {...getRootProps()}
        className={`flex items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 cursor-pointer transition-all ${
          isDragActive
            ? "border-zinc-400 bg-zinc-800/40"
            : "border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/20"
        }`}
      >
        <input {...getInputProps()} />
        <span className="text-[13px] text-zinc-600">+</span>
        <span className="text-[11px] font-medium text-zinc-600">
          {isDragActive ? "Drop to add" : `Add another poster (${remaining} remaining)`}
        </span>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`relative rounded-xl border-2 border-dashed cursor-pointer transition-all overflow-hidden ${
        isDragActive
          ? "border-zinc-400 bg-zinc-800/40"
          : "border-zinc-800/80 hover:border-zinc-600 hover:bg-zinc-900/60"
      }`}
      style={{ padding: "28px 20px" }}
    >
      <input {...getInputProps()} />
      <div className="text-center space-y-3">
        {/* Ghost poster placeholders */}
        <div className="flex justify-center gap-2 mb-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-zinc-800/60 bg-zinc-900/60"
              style={{
                width: 36,
                height: 48,
                opacity: 1 - i * 0.25,
                transform: `rotate(${(i - 1) * 4}deg)`,
              }}
            />
          ))}
        </div>
        <div>
          <div className="text-[13px] font-medium text-zinc-400 mb-1">
            {isDragActive ? "Drop your posters here" : "Drop posters to analyze"}
          </div>
          <div className="text-[11px] text-zinc-600">
            or <span className="text-zinc-400 underline underline-offset-2">browse files</span> · up to 5 posters
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ReferencePanel ───────────────────────────────────────────────────────

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

  const images = reference.images ?? [];
  const hasImages = images.length > 0;
  const anyTarget = Object.values(reference.targets).some(Boolean);
  const noTargetsWarning = hasImages && !anyTarget;
  const hasPalette   = images.some((i) => i.palette.length > 0);
  const strictCount  = images.filter((i) => i.mode === "strict").length;
  const hasAnalysis  = images.some((i) => i.analysis !== null);
  const remaining    = 5 - images.length;

  const handleDrop = useCallback(
    async (files: File[]) => {
      if (adding) return;
      setAdding(true);
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
    [images, adding, remaining, addReferenceImage, updateReferenceImage],
  );

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

  async function generateFromReference(matchMode?: "max") {
    if (!project || !hasImages) return;
    if (!anyTarget && matchMode !== "max") {
      setGenToast("Select at least one target to apply reference.");
      return;
    }

    setGenLoading(true);
    setGenToast("");
    setPromptPreview(null);

    const refForGeneration = matchMode === "max"
      ? {
          ...reference,
          targets: { mood: true, color: true, backgroundStyle: true, typography: false, layout: true, texture: true, lighting: true },
          images: reference.images.map((img) => ({ ...img, mode: "strict" as ReferenceMode, strength: 100 })),
        }
      : reference;

    const refCtx = buildEditorRefCtx(refForGeneration);

    try {
      const results = await Promise.all(
        [1, 2].map(() =>
          fetch("/api/generate/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: project.promptHistory.at(-1) ?? "",
              styleRecipe: project.styleRecipe,
              width: project.canvas.width,
              height: project.canvas.height,
              reference: refCtx,
            }),
          }).then((r) => r.json() as Promise<{ url?: string; promptPreview?: string }>),
        ),
      );

      const preview = results[0]?.promptPreview;
      if (preview) { setPromptPreview(preview); setShowPrompt(false); }

      let added = 0;
      for (const { url } of results) {
        if (!url) continue;
        addAsset({
          id: uuidv4(), userId: "local", imageUrl: url,
          fileName: `ref-gen-${Date.now()}`, createdAt: new Date().toISOString(),
          generatedTag: matchMode === "max" ? "match-max" : "from reference",
        });

        if (added === 0) {
          const bgLayer = getSortedLayers().find((l) => l.type === "backgroundImage");
          if (bgLayer) {
            updateLayer(bgLayer.id, { imageData: { src: url, fit: "fill" } });
          } else {
            const canvas = project.canvas;
            const newLayer: PosterLayer = {
              id: uuidv4(), type: "backgroundImage", label: "Background",
              x: 0, y: 0, width: canvas.width, height: canvas.height,
              rotation: 0, opacity: 1, visible: true, locked: false, zIndex: 1,
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

      addAsset({
        id: uuidv4(), userId: "local", imageUrl: res.url,
        fileName: `graphic-match-${Date.now()}`, createdAt: new Date().toISOString(),
        generatedTag: "graphic match",
      });

      const bgLayer = getSortedLayers().find((l) => l.type === "backgroundImage");
      if (bgLayer) {
        updateLayer(bgLayer.id, { imageData: { src: res.url, fit: "fill" } });
      } else {
        const canvas = project.canvas;
        const newLayer: PosterLayer = {
          id: uuidv4(), type: "backgroundImage", label: "Background",
          x: 0, y: 0, width: canvas.width, height: canvas.height,
          rotation: 0, opacity: 1, visible: true, locked: false, zIndex: 1,
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

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-3 space-y-4">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="pt-1 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold tracking-widest uppercase text-zinc-400">
                Reference Style Analyzer
              </div>
              {hasImages && (
                <div className="text-[10px] text-zinc-600 mt-0.5">
                  {images.length}/5 posters loaded
                  {strictCount > 0 && <span className="text-amber-500/70 ml-1">· {strictCount} strict</span>}
                </div>
              )}
            </div>
            {/* Animated scan icon when any are analyzing */}
            {images.some((i) => i.analyzing) && (
              <span className="w-3 h-3 rounded-full border-2 border-zinc-700 border-t-zinc-300 animate-spin block flex-none" />
            )}
          </div>

          {/* Explanatory copy — shown only when empty */}
          {!hasImages && (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 px-3 py-3 space-y-2">
              <p className="text-[12px] font-medium text-zinc-400">
                Upload 1–5 posters.
              </p>
              <p className="text-[11px] text-zinc-600 leading-relaxed">
                Poster Agent will analyze:
              </p>
              <ul className="space-y-1">
                {[
                  "Typography & font character",
                  "Layout structure & composition",
                  "Color palette & mood",
                  "Image treatment & texture",
                  "Visual atmosphere",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className="w-1 h-1 rounded-full bg-zinc-600 flex-none" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-zinc-600 leading-relaxed pt-1 border-t border-zinc-800/60">
                Results become a reusable style recipe applied to every AI generation.
              </p>
            </div>
          )}
        </div>

        {/* ── Poster cards ────────────────────────────────────────────────── */}
        {hasImages && (
          <div className="space-y-3">
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

        {/* ── Upload zone ─────────────────────────────────────────────────── */}
        {remaining > 0 && (
          <UploadZone
            onAdd={handleDrop}
            disabled={adding}
            hasImages={hasImages}
            remaining={remaining}
          />
        )}

        {/* ── No targets warning ──────────────────────────────────────────── */}
        {noTargetsWarning && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-[11px] font-medium text-amber-400/80 border border-amber-500/20 bg-amber-500/5">
            <span className="flex-none">⚠</span>
            <span>Select at least one style target below so the AI knows what to extract.</span>
          </div>
        )}

        {/* ── Style targets ────────────────────────────────────────────────── */}
        {hasImages && (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500">
              Extract from reference
            </div>
            <div className="grid grid-cols-2 gap-1">
              {TARGETS.map(({ key, label, icon }) => {
                const active = reference.targets[key];
                return (
                  <button
                    key={key}
                    onClick={() => toggleTarget(key)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all border ${
                      active
                        ? "bg-zinc-800/80 border-zinc-600/60 text-zinc-200"
                        : "bg-transparent border-zinc-800/60 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400"
                    }`}
                  >
                    <span className="text-[11px] w-3.5 text-center flex-none">{icon}</span>
                    <span className="text-[11px] font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Global instruction ──────────────────────────────────────────── */}
        {hasImages && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500">
              Extra instruction
            </div>
            <textarea
              value={reference.globalInstruction || reference.instruction}
              onChange={(e) => setReference({ globalInstruction: e.target.value, instruction: e.target.value })}
              placeholder="e.g. Use only the color palette, keep the composition loose…"
              rows={2}
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl text-zinc-300 text-[11px] leading-relaxed outline-none px-3 py-2 placeholder:text-zinc-700 resize-none focus:border-zinc-600 transition-colors"
            />
          </div>
        )}

        {/* ── Generate CTAs ────────────────────────────────────────────────── */}
        {project && hasImages && (
          <div className="space-y-2 pt-1 border-t border-zinc-800/60">

            {/* Generation mode indicator */}
            <div className="flex items-center gap-2 px-0.5 pb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-none" />
              <span className="text-[11px] font-medium text-zinc-400">
                Reference style active · preset suppressed
              </span>
            </div>

            {/* Apply palette to text */}
            {hasPalette && (
              <button
                onClick={applyPaletteToCanvas}
                className="w-full py-2 text-[12px] font-medium text-zinc-500 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-600 rounded-xl transition-colors"
              >
                Apply palette to text layers
              </button>
            )}

            {/* Primary generate */}
            <button
              onClick={() => generateFromReference()}
              disabled={genLoading || graphicLoading}
              className="w-full py-3 text-[13px] font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-zinc-100 text-zinc-900 hover:bg-white"
            >
              {genLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 border-2 border-zinc-400 border-t-zinc-800 rounded-full animate-spin inline-block" />
                  Generating…
                </span>
              ) : (
                "Generate from Reference →"
              )}
            </button>

            {/* Match Reference More */}
            {hasAnalysis && (
              <button
                onClick={() => generateFromReference("max")}
                disabled={genLoading || graphicLoading}
                className="w-full py-2.5 text-[12px] font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-amber-500/30 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50"
                title="Regenerates at strength 100 + strict mode + all visual targets enabled"
              >
                Match Reference More →
              </button>
            )}

            {/* Graphic match */}
            {hasPalette && (
              <button
                onClick={generateGraphicMatch}
                disabled={genLoading || graphicLoading}
                className="w-full py-2 text-[12px] font-medium text-zinc-600 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-600 rounded-xl transition-colors disabled:opacity-40"
                title="Generates a blurred abstract SVG directly from the extracted palette"
              >
                {graphicLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin inline-block" />
                    Building…
                  </span>
                ) : "Generate Graphic Match →"}
              </button>
            )}

            {/* Toast feedback */}
            {genToast && (
              <p className="text-[11px] font-medium text-zinc-400 text-center py-1">{genToast}</p>
            )}

            {/* Prompt preview */}
            {promptPreview && (
              <div className="border-t border-zinc-800/60 pt-2">
                <button
                  onClick={() => setShowPrompt((v) => !v)}
                  className="w-full text-left text-[10px] font-mono text-zinc-700 hover:text-zinc-500 transition-colors pb-1"
                >
                  {showPrompt ? "▲ hide prompt" : "▼ show prompt sent to model"}
                </button>
                {showPrompt && (
                  <pre className="font-mono text-[9px] text-zinc-600 whitespace-pre-wrap leading-relaxed overflow-auto max-h-48 bg-zinc-950 border border-zinc-800/60 rounded-lg p-2.5">
                    {promptPreview}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Helper: build EditorRefCtx from store reference state ─────────────────────

export function buildEditorRefCtx(reference: ReferenceConfig) {
  const images = reference.images ?? [];
  if (images.length > 0) {
    return {
      strength: 50,
      targets: reference.targets ?? {},
      globalInstruction: reference.globalInstruction || reference.instruction || undefined,
      references: images.map((img) => ({
        id: img.id,
        mode: img.mode,
        role: img.role,
        strength: img.strength,
        targets: reference.targets,
        palette: (img.palette ?? []).length > 0 ? img.palette : undefined,
        analysis: img.analysis ?? undefined,
      })),
    };
  }
  return {
    strength: reference.strength,
    targets: reference.targets ?? {},
    instruction: reference.instruction || undefined,
    palette: (reference.palette ?? []).length > 0 ? reference.palette : undefined,
    analysis: reference.analysis ?? undefined,
  };
}
