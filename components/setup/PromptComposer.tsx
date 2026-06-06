"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { v4 as uuidv4 } from "uuid";
import { usePosterStore } from "@/store/posterStore";
import { RECIPE_LIST } from "@/lib/styleRecipes";
import { extractPaletteFromUrl } from "@/lib/colorExtract";
import type { PaletteColor } from "@/lib/colorExtract";
import type { ReferenceAnalysis } from "@/types/poster";
import { t } from "@/styles/tokens";
import type {
  PosterType,
  Language,
  StyleRecipe,
  StyleSource,
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

interface CollageImageEntry {
  id: string;
  /** Original uploaded image data URL */
  originalUrl: string;
  /** Processed: background-removed + grayscale. Null until processing completes. */
  processedUrl: string | null;
  status: "uploading" | "extracting" | "done" | "error";
  error?: string;
}

// ─── Collage image processing ─────────────────────────────────────────────────

/**
 * Converts a PNG data URL (with transparency) to grayscale.
 * Preserves the alpha channel so transparent areas remain transparent.
 */
function toGrayscaleDataUrl(objectUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("no 2d context")); return; }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 0) { // only non-transparent pixels
          const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
          d[i] = d[i + 1] = d[i + 2] = gray;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

/**
 * Runs background removal and grayscale conversion on an image data URL.
 * Returns the processed data URL (transparent cutout, grayscale).
 */
async function processCollageImage(dataUrl: string): Promise<string> {
  // Convert data URL to Blob for the bg-removal library
  const res = await fetch(dataUrl);
  const blob = await res.blob();

  const { removeBackground } = await import("@imgly/background-removal");
  const cutoutBlob = await removeBackground(blob, {
    model: "isnet_fp16",
    output: { format: "image/png", quality: 0.9 },
  });

  const objectUrl = URL.createObjectURL(cutoutBlob);
  try {
    const grayscale = await toGrayscaleDataUrl(objectUrl);
    return grayscale;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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

// ─── Shared sub-components ────────────────────────────────────────────────────

/** Section label — uses the token so a single token change updates all labels */
function SectionLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className={`block ${t.sectionLabel}`}>
      {children}
      {optional && <span className={`${t.mutedText} normal-case tracking-normal font-sans ml-1.5`}>— optional</span>}
    </label>
  );
}

/** Option chip — uses btn tokens so active/inactive state is token-driven */
function Chip({
  children,
  active,
  onClick,
  small,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  const cls = small
    ? active ? t.btn.chipSmActive : t.btn.chipSmInactive
    : active ? t.btn.chipActive   : t.btn.chipInactive;
  return (
    <button onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

// ─── PromptComposer ───────────────────────────────────────────────────────────

export function PromptComposer() {
  const { setProject } = usePosterStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [cfg, setCfg] = useState<PosterSetupConfig>({
    posterType:  "poster",
    canvasSize:  "a4",
    language:    "en",
    styleRecipe: "gallery-minimal",
    styleSource: "preset",
    imageSource: "generate",
    imageStyle:  "cinematic-photography",
    prompt:      "",
    aiWriteCopy: false,
  });

  const [refImages, setRefImages]       = useState<RefImage[]>([]);
  const [refStrength, setRefStrength]   = useState(55);
  const [refTargets, setRefTargets]     = useState<RefTargets>({
    mood: true, color: true, layout: false,
    backgroundStyle: false, typography: false, texture: false, lighting: false,
  });
  const [refExtracting, setRefExtracting] = useState(false);
  const [showDebug, setShowDebug]         = useState(false);
  const [collageImages, setCollageImages] = useState<CollageImageEntry[]>([]);

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

  const onCollageDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const remaining = 3 - collageImages.length;
      if (remaining <= 0) return;
      const filesToProcess = acceptedFiles.slice(0, remaining);
      const newIds = filesToProcess.map(() => uuidv4());

      setCollageImages((prev) => [
        ...prev,
        ...filesToProcess.map((_, i) => ({
          id: newIds[i],
          originalUrl: "",
          processedUrl: null,
          status: "uploading" as const,
        })),
      ]);

      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const entryId = newIds[i];
        let dataUrl: string;
        try {
          dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve((e.target?.result as string) ?? "");
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        } catch {
          setCollageImages((prev) => prev.map((e) =>
            e.id === entryId ? { ...e, status: "error" as const, error: "Failed to read file" } : e,
          ));
          continue;
        }

        setCollageImages((prev) => prev.map((e) =>
          e.id === entryId ? { ...e, originalUrl: dataUrl, status: "extracting" as const } : e,
        ));

        try {
          const processed = await processCollageImage(dataUrl);
          setCollageImages((prev) => prev.map((e) =>
            e.id === entryId ? { ...e, processedUrl: processed, status: "done" as const } : e,
          ));
        } catch {
          setCollageImages((prev) => prev.map((e) =>
            e.id === entryId ? { ...e, originalUrl: dataUrl, status: "error" as const, error: "Subject extraction failed" } : e,
          ));
        }
      }
    },
    [collageImages.length],
  );

  const {
    getRootProps: getCollageRootProps,
    getInputProps: getCollageInputProps,
    isDragActive: isCollageDragActive,
  } = useDropzone({
    onDrop: onCollageDrop,
    accept: { "image/*": [] },
    disabled: busy || collageImages.length >= 3,
  });

  function removeRefImage(id: string) {
    setRefImages((prev) => prev.filter((r) => r.id !== id));
  }

  /**
   * Builds the reference context sent to the API.
   * In "reference" style mode: builds the full `references` array so
   * `buildReferenceStyleInstruction()` on the server can synthesize a complete
   * style spec. All targets are enabled — the reference drives everything.
   * In "preset" style mode: builds the legacy flat format for blended guidance.
   */
  function buildRefCtx() {
    if (refImages.length === 0) return undefined;

    const isRefMode = cfg.styleSource === "reference";

    if (isRefMode) {
      // Reference mode: full multi-ref format with all targets active
      const allTargets = {
        mood: true, color: true, backgroundStyle: true,
        typography: true, layout: true, texture: true, lighting: true,
      };
      return {
        strength: 100,
        targets: allTargets,
        references: refImages.map((img, i) => ({
          id: img.id,
          mode: "strict" as const,
          role: (i === 0 ? "primary" : i === 1 ? "secondary" : "accent") as "primary" | "secondary" | "accent",
          strength: 100,
          targets: allTargets,
          palette: img.palette,
          analysis: img.analysis,
        })),
      };
    }

    // Preset mode: legacy flat format — blended guidance only
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
    return {
      strength: refStrength,
      targets: refTargets,
      palette: merged,
      analysis: refImages[0]?.analysis ?? null,
      instruction: `${refImages.length} reference image${refImages.length > 1 ? "s" : ""} provided`,
    };
  }

  const noTargetsSelected =
    cfg.styleSource !== "reference" &&
    refImages.length > 0 &&
    !Object.values(refTargets).some(Boolean);

  const analysisAvailable = refImages.some((r) => r.analysis !== null);

  async function generate() {
    setBusy(true);
    setError("");
    const refCtx = buildRefCtx();

    const isCollageMode = cfg.styleRecipe === "collage-poster" && cfg.styleSource !== "reference";
    const processedSubjects = isCollageMode
      ? collageImages.filter((i) => i.status === "done" && i.processedUrl).map((i) => i.processedUrl!)
      : [];

    // Client-side debug — visible in browser DevTools console
    console.group("[PromptComposer] Generation debug");
    console.log("styleSource:    ", cfg.styleSource ?? "preset (default)");
    console.log("selectedPreset: ", cfg.styleSource === "reference" ? "(SUPPRESSED)" : cfg.styleRecipe);
    console.log("isCollageMode:  ", isCollageMode, "subjects:", processedSubjects.length);
    console.log("referenceAnalysisExists:", refImages.some((r) => r.analysis != null));
    console.log("refCtx.references:", (refCtx as { references?: unknown })?.references ?? "(none — legacy format)");
    console.log("full refCtx:", refCtx);
    console.groupEnd();

    // Guard: collage mode requires at least one processed image
    if (isCollageMode && processedSubjects.length === 0) {
      setError("Upload and wait for at least one image to finish processing before generating.");
      setBusy(false);
      return;
    }

    // Guard: warn if reference mode selected but no images uploaded
    if (cfg.styleSource === "reference" && refImages.length === 0) {
      setError("Upload at least one reference poster before generating in reference style mode.");
      setBusy(false);
      return;
    }

    try {
      const layoutRes = await fetch("/api/generate/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup: cfg, lockedLayers: [], reference: refCtx, collageSubjects: processedSubjects }),
      });
      if (!layoutRes.ok) throw new Error();
      const { layers, canvas, imagePrompt, isCollage: isCollageResult, demo: layoutDemo } = await layoutRes.json();

      let finalLayers = layers;

      const isRefMode = cfg.styleSource === "reference";

      if (!isCollageResult && (cfg.imageSource === "generate" || isRefMode)) {
        // In reference mode, always generate image from reference (imageSource may be "reference")
        const imgRes = await fetch("/api/generate/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // userPrompt = the original user-typed concept ("rain") — must reach Flux
            userPrompt: cfg.prompt,
            // prompt = GPT-4o's atmospheric fluxPrompt (style context, may differ from subject)
            prompt: imagePrompt,
            // IMPORTANT: only send styleRecipe in preset mode — reference mode must not receive it
            ...(isRefMode ? {} : {
              styleRecipe: cfg.styleRecipe,
              imageStyle: cfg.imageStyle,
              customImagePrompt: cfg.customImagePrompt,
            }),
            styleSource: cfg.styleSource ?? "preset",
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
    <div className={`min-h-screen ${t.surface.page} flex flex-col`}>

      {/* Wordmark */}
      <div className="px-8 pt-8">
        <span className={`${t.scale.xs} font-mono tracking-[0.2em] text-zinc-600 uppercase`}>
          poster agent
        </span>
      </div>

      {/* Main composer */}
      <div className="flex-1 flex items-start justify-center px-8 pt-16 pb-24">
        <div className={`w-full max-w-xl ${t.gap.section}`}>

          {/* ── What are we making? ─────────────────────────────────────── */}
          <div className={t.gap.group}>
            <SectionLabel>What are we making?</SectionLabel>
            <textarea
              value={cfg.prompt}
              onChange={(e) => set({ prompt: e.target.value })}
              placeholder="Describe the concept, mood, or subject…"
              rows={3}
              className={`${t.input.underline} resize-none pb-2`}
            />
          </div>

          {/* ── Style source — explicit single choice ────────────────────── */}
          <div className={t.gap.group}>
            <SectionLabel>Style source</SectionLabel>
            <p className={`${t.mutedText} -mt-1`}>
              Choose where the visual style comes from.
            </p>

            {/* Source selector */}
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  {
                    value: "preset" as StyleSource,
                    label: "Preset",
                    desc: "Pick from 8 curated design recipes",
                  },
                  {
                    value: "reference" as StyleSource,
                    label: "Reference image",
                    desc: "Upload a poster — AI extracts and applies its style",
                  },
                ] as const
              ).map(({ value, label, desc }) => {
                const active = cfg.styleSource === value;
                return (
                  <button
                    key={value}
                    onClick={() => set({ styleSource: value })}
                    className={`text-left px-3 py-2.5 rounded-lg border transition-all ${
                      active
                        ? "border-zinc-400 bg-zinc-900 text-zinc-100"
                        : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    <div className={`${t.scale.base} font-semibold mb-0.5`}>{label}</div>
                    <div className={`${t.scale.xs} leading-snug opacity-70`}>{desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Preset recipe (only when styleSource === "preset") ────────── */}
          {cfg.styleSource !== "reference" && (
            <div className={t.gap.group}>
              <SectionLabel>Style</SectionLabel>
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
          )}

          {/* ── Collage image upload (only for collage-poster in preset mode) ── */}
          {cfg.styleSource !== "reference" && cfg.styleRecipe === "collage-poster" && (
            <div className={t.gap.group}>
              <SectionLabel>Collage images</SectionLabel>
              <p className={`${t.mutedText} -mt-1`}>
                Upload 1–3 images. Poster Agent will automatically extract subjects and build a collage composition.
              </p>

              {collageImages.length < 3 && (
                <div
                  {...getCollageRootProps()}
                  className={`py-5 text-center border border-dashed rounded-lg cursor-pointer transition-colors ${
                    isCollageDragActive
                      ? "border-zinc-400 bg-zinc-800/30"
                      : collageImages.length > 0
                      ? "border-zinc-700 hover:border-zinc-500"
                      : "border-zinc-800 hover:border-zinc-600"
                  }`}
                >
                  <input {...getCollageInputProps()} />
                  <div className="space-y-1">
                    <div className={`${t.scale.base} font-medium text-zinc-400`}>
                      {isCollageDragActive
                        ? "Drop to add"
                        : collageImages.length > 0
                        ? `Add another image (${collageImages.length}/3)`
                        : "Drop images here, or click to browse"}
                    </div>
                    {collageImages.length === 0 && (
                      <div className={t.mutedText}>JPG, PNG · up to 3 images</div>
                    )}
                  </div>
                </div>
              )}

              {collageImages.length > 0 && (
                <div className="flex gap-3 flex-wrap pt-1">
                  {collageImages.map((img) => (
                    <div key={img.id} className="relative group flex-none" style={{ width: 64 }}>
                      {img.originalUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img.processedUrl ?? img.originalUrl}
                          alt="collage subject"
                          className="w-full rounded-md border border-zinc-800/60 object-cover"
                          style={{ aspectRatio: "3/4", opacity: img.status === "done" ? 1 : 0.45 }}
                        />
                      ) : (
                        <div
                          className="w-full rounded-md border border-zinc-800/60 bg-zinc-900"
                          style={{ aspectRatio: "3/4" }}
                        />
                      )}
                      {(img.status === "uploading" || img.status === "extracting") && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="w-4 h-4 border border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
                        </div>
                      )}
                      <div className={`${t.scale.xs} font-mono text-center mt-0.5 truncate ${
                        img.status === "done" ? "text-green-400/70"
                        : img.status === "error" ? "text-red-400/70"
                        : "text-zinc-500"
                      }`}>
                        {img.status === "uploading" ? "reading…"
                         : img.status === "extracting" ? "extracting…"
                         : img.status === "done" ? "✓ ready"
                         : img.error ?? "error"}
                      </div>
                      <button
                        onClick={() => setCollageImages((prev) => prev.filter((e) => e.id !== img.id))}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-[9px] items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              {collageImages.length === 0 && (
                <p className={`${t.scale.xs} font-mono text-amber-600/70`}>
                  ⚠ Upload at least one image to generate a collage.
                </p>
              )}
            </div>
          )}

          {/* ── Reference style upload (only when styleSource === "reference") */}
          {cfg.styleSource === "reference" && (
            <div className={t.gap.group}>
              <SectionLabel>Reference poster</SectionLabel>
              <p className={`${t.mutedText} -mt-1`}>
                Upload a poster whose style you want to replicate. The AI will analyze typography,
                layout, color palette, image treatment, composition, and mood — and use that as the
                complete style specification. No preset recipe will be applied.
              </p>

              {/* Drop zone */}
              <div
                {...getRefRootProps()}
                className={`py-5 text-center border border-dashed rounded-lg cursor-pointer transition-colors ${
                  isRefDragActive
                    ? "border-zinc-400 bg-zinc-800/30"
                    : refImages.length > 0
                    ? "border-zinc-700 hover:border-zinc-500"
                    : "border-zinc-800 hover:border-zinc-600"
                }`}
              >
                <input {...getRefInputProps()} />
                <div className="space-y-1">
                  <div className={`${t.scale.base} font-medium text-zinc-400`}>
                    {refExtracting
                      ? "Analyzing style…"
                      : isRefDragActive
                      ? "Drop to analyze"
                      : refImages.length > 0
                      ? "Drop another poster to add"
                      : "Drop a poster here, or click to browse"}
                  </div>
                  {!refExtracting && refImages.length === 0 && (
                    <div className={`${t.mutedText}`}>JPG, PNG · up to 5 posters</div>
                  )}
                </div>
              </div>

              {/* Uploaded thumbnails + analysis status */}
              {refImages.length > 0 && (
                <div className={t.gap.tight}>
                  <div className="flex gap-2 flex-wrap">
                    {refImages.map((img) => (
                      <div key={img.id} className="relative group flex-none" style={{ width: 56 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt="reference"
                          className="w-full rounded-md border border-zinc-800/60 object-cover"
                          style={{ aspectRatio: "3/4" }}
                        />
                        {/* Analysis status dot */}
                        <span
                          className="absolute top-1 right-1 w-2 h-2 rounded-full border border-zinc-900"
                          style={{
                            background: img.analysis ? "#4ade80" : img.analysisError ? "#f59e0b" : "#71717a",
                          }}
                          title={img.analysis ? "Style analyzed" : (img.analysisError || "Analyzing…")}
                        />
                        {/* Palette strip */}
                        {img.palette.length > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 flex rounded-b-md overflow-hidden h-1">
                            {img.palette.slice(0, 5).map((c, i) => (
                              <div key={i} className="flex-1" style={{ background: c.hex }} />
                            ))}
                          </div>
                        )}
                        {/* Remove */}
                        <button
                          onClick={() => removeRefImage(img.id)}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-[9px] items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex"
                        >×</button>
                      </div>
                    ))}
                  </div>

                  {/* Analysis summary line */}
                  <div className="flex items-center justify-between pt-1">
                    <span className={`${t.scale.xs} font-mono ${
                      analysisAvailable ? "text-green-400/80" : "text-zinc-600"
                    }`}>
                      {analysisAvailable
                        ? `✓ Style analyzed — ${refImages.filter((r) => r.analysis).length}/${refImages.length} poster${refImages.length > 1 ? "s" : ""}`
                        : refImages[0]?.analysisError
                        ? `⚠ ${refImages[0].analysisError}`
                        : "Analyzing…"}
                    </span>
                    <button
                      onClick={() => setShowDebug((v) => !v)}
                      className={`${t.scale.xs} font-mono text-zinc-700 hover:text-zinc-500 transition-colors`}
                    >
                      {showDebug ? "hide debug" : "debug output"}
                    </button>
                  </div>

                  {/* Debug panel */}
                  {showDebug && (
                    <div className="rounded-md p-2.5 space-y-1 font-mono bg-zinc-950 border border-zinc-800/60">
                      <div className={`${t.scale.xs} text-zinc-500 uppercase tracking-widest mb-1`}>debug — style extraction</div>
                      <div className={`${t.scale.xs} text-zinc-600`}>
                        styleSource: <span className="text-green-400/80">reference</span> · preset: <span className="text-red-400/70">suppressed</span>
                      </div>
                      {refImages.map((img, i) => (
                        <div key={img.id} className={`${t.scale.xs} text-zinc-600`}>
                          [img {i + 1}]
                          {img.analysis
                            ? ` ✓ ${img.analysis.styleClass} · ${img.analysis.mood}`
                            : img.analysisError
                            ? ` ⚠ ${img.analysisError}`
                            : " analyzing…"}
                          {img.palette.length > 0 && ` · palette: ${img.palette.slice(0, 3).map((p) => p.hex).join(", ")}`}
                        </div>
                      ))}
                      {refImages[0]?.analysis && (
                        <>
                          <div className={`${t.scale.xs} text-zinc-600 pt-1`}>visual summary: {refImages[0].analysis.visualSummary}</div>
                          <div className={`${t.scale.xs} text-zinc-600`}>composition: {refImages[0].analysis.composition}</div>
                          <div className={`${t.scale.xs} text-zinc-600`}>typography: {refImages[0].analysis.typographyStyle}</div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Warning: no images uploaded yet */}
              {refImages.length === 0 && !refExtracting && (
                <p className={`${t.scale.xs} font-mono text-amber-600/70`}>
                  ⚠ Upload at least one reference poster before generating.
                </p>
              )}
            </div>
          )}

          {/* ── Image source (preset mode only, hidden for collage-poster) ── */}
          {cfg.styleSource !== "reference" && cfg.styleRecipe !== "collage-poster" && (
            <div className={t.gap.group}>
              <SectionLabel>Image</SectionLabel>
              <div className="flex gap-2">
                {(["generate", "upload"] as ImageSource[]).map((s) => (
                  <Chip key={s} active={cfg.imageSource === s} onClick={() => set({ imageSource: s })}>
                    {s === "generate" ? "AI generate" : "Upload"}
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
                  className={t.input.underline}
                />
              )}
            </div>
          )}

          {/* ── Language + Canvas ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-8">
            <div className={t.gap.group}>
              <SectionLabel>Language</SectionLabel>
              <div className="flex gap-2">
                {([["en","EN"],["zh","中文"],["mixed","Bilingual"]] as [Language,string][]).map(([v, l]) => (
                  <Chip key={v} active={cfg.language === v} onClick={() => set({ language: v })} small>
                    {l}
                  </Chip>
                ))}
              </div>
            </div>

            <div className={t.gap.group}>
              <SectionLabel>Canvas</SectionLabel>
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

          {/* Custom canvas size */}
          {cfg.canvasSize === "custom" && (
            <div className="flex gap-6">
              <div>
                <label className={`${t.controlLabel} block mb-1`}>Width px</label>
                <input
                  type="number"
                  value={cfg.customWidth ?? 800}
                  onChange={(e) => set({ customWidth: Number(e.target.value) })}
                  className="block w-24 bg-transparent border-b border-zinc-800 focus:border-zinc-600 text-zinc-200 font-mono text-[12px] outline-none pb-1"
                />
              </div>
              <div>
                <label className={`${t.controlLabel} block mb-1`}>Height px</label>
                <input
                  type="number"
                  value={cfg.customHeight ?? 1200}
                  onChange={(e) => set({ customHeight: Number(e.target.value) })}
                  className="block w-24 bg-transparent border-b border-zinc-800 focus:border-zinc-600 text-zinc-200 font-mono text-[12px] outline-none pb-1"
                />
              </div>
            </div>
          )}

          <div className="border-t border-zinc-900" />

          {/* ── Copy toggle ──────────────────────────────────────────────── */}
          <div className={t.gap.group}>
            <button
              onClick={() => set({ aiWriteCopy: !cfg.aiWriteCopy })}
              className="flex items-center gap-3 group"
            >
              <span className={`w-4 h-4 border flex items-center justify-center text-[10px] transition-colors ${
                cfg.aiWriteCopy ? "border-zinc-400 text-zinc-200" : "border-zinc-700 text-transparent"
              }`}>
                ✓
              </span>
              <span className={`${t.scale.sm} font-medium text-zinc-500 group-hover:text-zinc-400 transition-colors`}>
                Let AI write poster copy
              </span>
            </button>

            {!cfg.aiWriteCopy && (
              <div className="space-y-3 pl-7">
                {[
                  { key: "userTitle",        ph: "Title" },
                  { key: "userSubtitle",     ph: "Subtitle / tagline" },
                  { key: "userDateLocation", ph: "Date · Venue" },
                  { key: "userCredits",      ph: "Credits" },
                ].map(({ key, ph }) => (
                  <input
                    key={key}
                    type="text"
                    value={(cfg as unknown as Record<string, string>)[key] ?? ""}
                    onChange={(e) => set({ [key]: e.target.value } as Partial<PosterSetupConfig>)}
                    placeholder={ph}
                    className={t.input.underline}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className={`font-mono ${t.scale.sm} text-red-500/80`}>{error}</p>
          )}

          {/* ── Generate button ───────────────────────────────────────────── */}
          <div className="flex justify-end pt-2">
            <button
              onClick={generate}
              disabled={
                busy ||
                (cfg.styleRecipe === "collage-poster" &&
                  cfg.styleSource !== "reference" &&
                  !collageImages.some((i) => i.status === "done"))
              }
              className="flex items-center gap-3 group disabled:opacity-30 transition-opacity"
            >
              {busy ? (
                <>
                  <span className="w-3 h-3 border border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
                  <span className={`font-mono ${t.scale.sm} text-zinc-500`}>Generating…</span>
                </>
              ) : (
                <>
                  <span className={`${t.scale.sm} font-medium text-zinc-500 group-hover:text-zinc-300 transition-colors`}>
                    Generate poster
                  </span>
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
