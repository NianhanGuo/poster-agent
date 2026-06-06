"use client";
import { useState, useCallback, useEffect, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { usePosterStore } from "@/store/posterStore";
import { PosterCanvas } from "./PosterCanvas";
import { LayerPanel } from "./LayerPanel";
import { ToolPanel } from "./ToolPanel";
import { AssetLibrary } from "./AssetLibrary";
import { ReferencePanel, buildEditorRefCtx } from "./ReferencePanel";
import { VersionStrip } from "./VersionStrip";
import { AlignmentBar } from "./AlignmentBar";
import { QuickPanel } from "./QuickPanel";
import { ImageEditModal } from "./ImageEditModal";
import { CutoutModal } from "./CutoutModal";
import { PromptComposer } from "@/components/setup/PromptComposer";
import type { DesignBrief, ReferenceTargets } from "@/types/poster";
import { CANVAS_PRESETS } from "@/types/poster";
import type { EnrichedRefCtx } from "@/lib/referencePrompt";
import { loadFontsFromLayers, loadGoogleFont } from "@/lib/fonts";
import { isCollageRecipe } from "@/lib/generationPipeline";

const DEFAULT_TARGETS: ReferenceTargets = {
  mood: false,
  color: false,
  backgroundStyle: false,
  typography: false,
  layout: false,
  texture: false,
  lighting: false,
};

type LeftTab = "layers" | "assets" | "reference";
type GenMode = "full" | "image" | "type";


export function EditorClient() {
  const {
    project,
    isGenerating,
    generatingStep,
    setGenerating,
    setProject,
    getSortedLayers,
    reference,
    designBrief,
    setDesignBrief,
    pushVersion,
  } = usePosterStore();

  const [leftTab, setLeftTab] = useState<LeftTab>("layers");
  const [command, setCommand] = useState("");
  const [genMode, setGenMode] = useState<GenMode>("full");
  const [genError, setGenError] = useState("");
  const [showGuides, setShowGuides] = useState(false);
  const [aiUsedLabel, setAiUsedLabel] = useState("");
  const [editImageLayerId, setEditImageLayerId] = useState<string | null>(null);
  const [cutoutLayerId, setCutoutLayerId] = useState<string | null>(null);

  const handleExport = useCallback(() => {
    (window as Window & { __posterExport?: () => void }).__posterExport?.();
  }, []);

  function exportJSON() {
    if (!project) return;
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.title.replace(/\s+/g, "-").toLowerCase()}.poster.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) usePosterStore.getState().redo();
        else usePosterStore.getState().undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!project) return <PromptComposer />;

  const isDemo = project.isDemo ?? false;
  const lockedLayers = getSortedLayers().filter((l) => l.locked);
  let refCtx: EnrichedRefCtx;
  try {
    refCtx = buildEditorRefCtx(reference);
  } catch (err) {
    console.error("[EditorClient] buildEditorRefCtx crashed:", err, "\nreference state:", reference);
    refCtx = { strength: 50, targets: DEFAULT_TARGETS };
  }

  // ── 2-step generation: brief → layout + image (parallel) ─────────────────

  async function runGeneration(promptOverride?: string) {
    if (!project) return;
    setGenError("");

    // Step 1: Design Director generates the brief
    setGenerating(true, "art directing…");
    let brief: DesignBrief | undefined;
    try {
      const briefRes = await fetch("/api/generate/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptOverride ?? project.promptHistory.at(-1) ?? "",
          posterType: project.posterType,
          styleRecipe: project.styleRecipe,
          language: project.language,
          reference: refCtx,
        }),
      });
      if (briefRes.ok) {
        const { brief: b } = await briefRes.json();
        brief = b;
        setDesignBrief(brief ?? null);
      }
    } catch {
      // Non-fatal — generation continues without brief
    }

    // Step 2: Layout (GPT-4o)
    setGenerating(true, "composing layout…");
    let layers: unknown[];
    let fluxPrompt = "";
    let imagePrompt = "";
    let layoutData: Record<string, unknown> = {};
    try {
      // For collage mode, re-use the subject images already in the project layers
      const isCollageProject = isCollageRecipe(project.styleRecipe);
      const existingSubjects = isCollageProject
        ? getSortedLayers()
            .filter((l) => l.type === "subjectImage" && l.imageData?.src && !l.imageData.src.startsWith("__"))
            .map((l) => l.imageData!.src)
        : [];

      const res = await fetch("/api/generate/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setup: {
            posterType: project.posterType,
            canvasSize: project.canvas.size,
            language: project.language,
            styleRecipe: project.styleRecipe,
            prompt: promptOverride ?? project.promptHistory.at(-1) ?? "",
            aiWriteCopy: true,
          },
          lockedLayers,
          brief,
          reference: refCtx,
          collageSubjects: existingSubjects,
        }),
      });
      if (!res.ok) throw new Error("layout failed");
      const data = await res.json();
      layoutData = data;
      layers = data.layers;
      fluxPrompt = data.fluxPrompt ?? "";
      imagePrompt = data.imagePrompt ?? fluxPrompt;

      // Immediately render layout with placeholder background
      const immediateProject = {
        ...project,
        layers: layers as typeof project.layers,
        promptHistory: promptOverride
          ? [...project.promptHistory, promptOverride]
          : project.promptHistory,
      };
      setProject(immediateProject);

      // Load Google Fonts referenced in the layout
      loadFontsFromLayers(data.layers);
      if (data.fonts) {
        Object.values(data.fonts as Record<string, string>).forEach((f) => f && loadGoogleFont(f));
      }

      // Store design metadata
      usePosterStore.getState().setDesignRationale(data.designRationale ?? null);
      usePosterStore.getState().setGeneratedPalette(data.palette ?? null);
    } catch {
      setGenError("Layout generation failed");
      setGenerating(false);
      return;
    }

    // Step 3: Image (Flux) — skipped for collage mode (subjects already injected)
    const isCollageLayout = (layoutData.isCollage as boolean) ?? false;
    const layoutPipeline  = (layoutData.pipeline as string) ?? "preset-standard";
    if (!isCollageLayout) {
      setGenerating(true, "generating atmosphere…");
      try {
        const imgRes = await fetch("/api/generate/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // userPrompt = original user concept so Flux always sees the subject
            userPrompt: promptOverride ?? project.promptHistory.at(-1) ?? "",
            fluxPrompt,
            prompt: imagePrompt,
            styleRecipe: project.styleRecipe,
            width: project.canvas.width,
            height: project.canvas.height,
            brief,
            reference: refCtx,
          }),
        });
        const { url } = await imgRes.json();
        if (url) {
          const updatedLayers = (layers as { type: string; imageData?: Record<string, unknown> }[]).map((l) =>
            l.type === "backgroundImage"
              ? { ...l, imageData: { ...(l.imageData ?? {}), src: url } }
              : l,
          );
          layers = updatedLayers;
        }
      } catch {
        // Non-fatal — use layout without new image
      }
    }

    // Step 4: Director — final composition approval
    setGenerating(true, "director review…");
    try {
      const dirRes = await fetch("/api/generate/director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layers,
          setup: {
            posterType:  project.posterType,
            canvasSize:  project.canvas.size,
            language:    project.language,
            styleRecipe: project.styleRecipe,
            styleSource: layoutPipeline === "reference-driven" ? "reference" : "preset",
            prompt:      promptOverride ?? project.promptHistory.at(-1) ?? "",
          },
          canvas:   { size: project.canvas.size, width: project.canvas.width, height: project.canvas.height },
          brief,
          pipeline: layoutPipeline,
        }),
      });
      if (dirRes.ok) {
        const dirData = await dirRes.json();
        if (dirData.layers && Array.isArray(dirData.layers)) {
          layers = dirData.layers;
          console.log(`[EditorClient] Director: ${dirData.verdict}`);
        }
      }
    } catch {
      // Non-fatal — Director is best-effort
    }

    const newProject = {
      ...project,
      layers: layers as typeof project.layers,
      promptHistory: promptOverride
        ? [...project.promptHistory, promptOverride]
        : project.promptHistory,
      designRationale: (layoutData.designRationale as string) ?? undefined,
      generatedPalette: (layoutData.palette as typeof project.generatedPalette) ?? undefined,
    };
    pushVersion(newProject, brief);
    setProject(newProject);
    setGenerating(false);

    // Build AI usage feedback label
    const refImages = reference.images ?? [];
    const refParts: string[] = [];
    if (refImages.length > 0) {
      const activeTargets = Object.entries(reference.targets).filter(([, v]) => v).map(([k]) => k);
      const strictCount = refImages.filter((i) => i.mode === "strict").length;
      if (activeTargets.length > 0)
        refParts.push(`ref: ${activeTargets.slice(0, 3).join(", ")}${strictCount > 0 ? ` (${strictCount} strict)` : ""}`);
    } else if (reference.imageUrl && Object.values(reference.targets).some(Boolean)) {
      const activeTargets = Object.entries(reference.targets).filter(([, v]) => v).map(([k]) => k);
      refParts.push(`ref: ${activeTargets.slice(0, 3).join(", ")}`);
    }
    if (brief?.mood) refParts.push(`mood: ${brief.mood}`);
    setAiUsedLabel(refParts.join(" · "));
    setTimeout(() => setAiUsedLabel(""), 8000);
  }

  async function regenerateImage() {
    if (!project) return;
    setGenerating(true, "generating image…");
    setGenError("");
    try {
      const lastPrompt = project.promptHistory.at(-1) ?? "";
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPrompt: lastPrompt,
          prompt: lastPrompt,
          styleRecipe: project.styleRecipe,
          width: project.canvas.width,
          height: project.canvas.height,
          brief: designBrief ?? undefined,
          reference: refCtx,
        }),
      });
      const { url } = await res.json();
      if (!url) return;
      const layers = project.layers.map((l) =>
        l.type === "backgroundImage" && !l.locked
          ? { ...l, imageData: { ...l.imageData, src: url } }
          : l,
      );
      const newProject = { ...project, layers };
      pushVersion(newProject, designBrief ?? undefined);
      setProject(newProject);
    } catch {
      setGenError("Image failed");
    } finally {
      setGenerating(false);
    }
  }

  async function runTypography(styleHint?: string) {
    if (!project) return;
    setGenerating(true, styleHint ? `making ${styleHint}…` : "refining type…");
    setGenError("");
    try {
      const res = await fetch("/api/generate/typography", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layers: project.layers,
          styleRecipe: project.styleRecipe,
          posterType: project.posterType,
          language: project.language,
          lockedLayers: lockedLayers.map((l) => l.id),
          styleHint: styleHint ?? "improve",
          reference: refCtx,
          brief: designBrief ?? undefined,
          canvasWidth: project.canvas.width,
          canvasHeight: project.canvas.height,
        }),
      });
      if (!res.ok) throw new Error();
      const { layers, designLog } = await res.json();
      loadFontsFromLayers(layers);
      if (designLog) {
        console.log("[typography] designLog:", designLog);
        const note = designLog.experimentalChoices && designLog.experimentalChoices !== "none"
          ? designLog.experimentalChoices
          : designLog.placementRationale ?? "";
        if (note) {
          setAiUsedLabel(`type: ${note.slice(0, 80)}`);
          setTimeout(() => setAiUsedLabel(""), 8000);
        }
      }
      setProject({ ...project, layers });
    } catch {
      setGenError("Type failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerate() {
    const cmd = command.trim();
    setCommand("");
    if (genMode === "image") {
      await regenerateImage();
    } else if (genMode === "type") {
      await runTypography(cmd || undefined);
    } else {
      await runGeneration(cmd || undefined);
    }
  }

  const LEFT_TABS: { id: LeftTab; label: string }[] = [
    { id: "layers",    label: "Layers" },
    { id: "assets",    label: "Assets" },
    { id: "reference", label: "Reference" },
  ];

  const QUICK_ACTIONS = [
    { label: "Regenerate", fn: () => runGeneration() },
    { label: "Image",      fn: regenerateImage },
    { label: "Cinematic",  fn: () => runTypography("cinematic") },
    { label: "Editorial",  fn: () => runTypography("editorial") },
    { label: "Brutalist",  fn: () => runTypography("brutalist") },
    { label: "Fit",        fn: () => runTypography("fit-to-canvas") },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#080808", color: "#e4e4e7" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header
        className="flex-none h-11 flex items-center gap-3 px-4 z-20 bg-zinc-950 border-b border-zinc-800/60"
        style={{ backdropFilter: "blur(20px)" }}
      >
        {/* Left: back + title */}
        <div className="flex items-center gap-2 flex-none">
          <button
            onClick={() => usePosterStore.getState().clearProject()}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-200 transition-colors px-2 py-1 rounded-md hover:bg-zinc-800/60"
          >
            <span className="text-[14px] leading-none">←</span>
            <span className="text-[12px] font-medium hidden sm:block">New</span>
          </button>
          <span className="text-zinc-800 select-none">|</span>
          <TitleEditor />
        </div>

        {/* Center: mode + prompt input */}
        <div className="flex-1 flex items-center gap-2 mx-2">
          {/* Generation mode pills */}
          <div className="flex-none flex items-center gap-0.5 bg-zinc-800/80 rounded-md p-0.5">
            {([ ["full", "Generate"], ["image", "Image"], ["type", "Type"] ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setGenMode(id)}
                className={`px-2.5 h-6 text-[11px] font-medium rounded transition-colors ${
                  genMode === id
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Prompt input */}
          <div className="flex-1 flex items-center gap-2 h-7 rounded-md px-3 bg-zinc-900 border border-zinc-800 focus-within:border-zinc-600 transition-colors">
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              placeholder={
                genMode === "image" ? "Describe image style (optional)…"
                : genMode === "type"  ? "Describe type style, e.g. 'cinematic'…"
                : "Describe what to change or create…"
              }
              disabled={isGenerating}
              className="flex-1 bg-transparent text-[12px] text-zinc-200 placeholder:text-zinc-600 outline-none disabled:opacity-40"
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-none text-[11px] font-medium text-zinc-400 hover:text-zinc-100 disabled:opacity-30 transition-colors pl-2"
              style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }}
            >
              {isGenerating ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full border border-zinc-600 border-t-zinc-300 animate-spin inline-block" />
                  <span className="text-zinc-500">{generatingStep}</span>
                </span>
              ) : (
                genMode === "full" ? "Run" : genMode === "image" ? "Regen" : "Retype"
              )}
            </button>
          </div>
        </div>

        {/* Right: brief + error + canvas size + export + user */}
        <div className="flex items-center gap-2 flex-none">
          {designBrief && !isGenerating && (
            <span className="text-[11px] text-zinc-600 italic max-w-[100px] truncate hidden lg:block" title={designBrief.designRationale}>
              {designBrief.mood}
            </span>
          )}
          {isDemo && (
            <span className="text-[11px] text-zinc-700 hidden sm:block" title="Add OPENAI_API_KEY for AI generation">demo</span>
          )}
          {genError && !isGenerating && (
            <span className="text-[11px] text-red-400/90">{genError}</span>
          )}
          <CanvasSizeMenu />
          <ExportMenu onPng={handleExport} onJson={exportJSON} />
          <PanelErrorBoundary name="UserMenu"><UserMenu /></PanelErrorBoundary>
        </div>
      </header>


      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">

        {/* Left sidebar */}
        <aside
          className="w-52 flex-none flex flex-col bg-zinc-950 border-r border-zinc-800/60"
        >
          <div className="flex-none flex px-1 border-b border-zinc-800/60">
            {LEFT_TABS.map(({ id, label }) => {
              const isRef = id === "reference";
              const refCount = isRef ? (reference.images ?? []).length : 0;
              const active = leftTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setLeftTab(id)}
                  className={`relative flex-1 flex items-center justify-center gap-1 px-2 py-2.5 text-[12px] font-medium transition-colors ${
                    active ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {label}
                  {isRef && refCount > 0 && (
                    <span className="w-3.5 h-3.5 rounded-full text-[8px] flex items-center justify-center bg-green-500/20 text-green-400 border border-green-500/30">
                      {refCount}
                    </span>
                  )}
                  {active && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-zinc-300 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex-1 overflow-y-auto">
            {leftTab === "layers"    && <LayerPanel />}
            {leftTab === "assets"    && <PanelErrorBoundary name="AssetLibrary"><AssetLibrary /></PanelErrorBoundary>}
            {leftTab === "reference" && <PanelErrorBoundary name="ReferencePanel"><ReferencePanel /></PanelErrorBoundary>}
          </div>
        </aside>

        {/* Center: toolbar + canvas + versions */}
        <main className="flex-1 flex flex-col min-w-0">

          {/* Action bar: quick-actions + alignment + guides */}
          <div className="flex-none h-8 flex items-center px-3 gap-0 border-b border-zinc-800/40 bg-zinc-950/50">
            {/* Quick generation actions */}
            {QUICK_ACTIONS.map((a, i) => (
              <span key={a.label} className="flex items-center">
                {i > 0 && <span className="mx-2 text-zinc-800 select-none">·</span>}
                <button
                  onClick={a.fn}
                  disabled={isGenerating}
                  className="text-[11px] font-medium text-zinc-600 hover:text-zinc-200 disabled:opacity-30 transition-colors"
                >
                  {a.label}
                </button>
              </span>
            ))}

            <span className="mx-3 text-zinc-800 select-none">|</span>
            <AlignmentBar />

            <span className="mx-2 text-zinc-800 select-none">|</span>
            <button
              onClick={() => setShowGuides((g) => !g)}
              title="Toggle safe margin guides"
              className={`text-[11px] font-medium transition-colors ${showGuides ? "text-zinc-400" : "text-zinc-700 hover:text-zinc-400"}`}
            >
              Guides
            </button>
          </div>

          {/* Canvas — PosterCanvas fills the parent absolutely */}
          <div className="flex-1 relative" style={{ background: "#050507" }}>
            <PosterCanvas showGuides={showGuides} />
            <div className="absolute top-3 left-3 z-10">
              <QuickPanel />
            </div>
          </div>

          {/* Version strip */}
          <VersionStrip />
        </main>

        {/* Right inspector */}
        <aside
          className="w-56 flex-none overflow-y-auto bg-zinc-950 border-l border-zinc-800/60"
        >
          <PanelErrorBoundary name="ToolPanel"><ToolPanel onTypography={runTypography} onEditImage={setEditImageLayerId} onCutout={setCutoutLayerId} /></PanelErrorBoundary>
        </aside>
      </div>

      {/* ── Floating undo / redo ────────────────────────────────────────────── */}
      <UndoRedoWidget />

      {/* ── Image edit modal ────────────────────────────────────────────────── */}
      {editImageLayerId && (
        <ImageEditModal
          layerId={editImageLayerId}
          onClose={() => setEditImageLayerId(null)}
        />
      )}

      {/* ── Cutout modal ─────────────────────────────────────────────────────── */}
      {cutoutLayerId && (
        <CutoutModal
          sourceLayerId={cutoutLayerId}
          onClose={() => setCutoutLayerId(null)}
        />
      )}
    </div>
  );
}

// ─── Undo / redo widget ────────────────────────────────────────────────────────

function UndoRedoWidget() {
  const history = usePosterStore((s) => s.history);
  const historyIndex = usePosterStore((s) => s.historyIndex);
  const undo = usePosterStore((s) => s.undo);
  const redo = usePosterStore((s) => s.redo);
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  if (!canUndo && !canRedo) return null;

  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-0.5 px-1.5 py-1 rounded-md"
      style={{
        background: "rgba(12,12,14,0.82)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      }}
    >
      <button
        onClick={undo}
        disabled={!canUndo}
        title="Undo (⌘Z)"
        className="w-6 h-6 flex items-center justify-center font-mono text-[11px] text-zinc-400 hover:text-zinc-100 disabled:opacity-20 transition-colors rounded"
      >
        ↩
      </button>
      <span className="font-mono text-[9px] text-zinc-600 px-1">
        {historyIndex}/{history.length - 1}
      </span>
      <button
        onClick={redo}
        disabled={!canRedo}
        title="Redo (⌘⇧Z)"
        className="w-6 h-6 flex items-center justify-center font-mono text-[11px] text-zinc-400 hover:text-zinc-100 disabled:opacity-20 transition-colors rounded"
      >
        ↪
      </button>
    </div>
  );
}

// ─── Title editor ──────────────────────────────────────────────────────────────

function TitleEditor() {
  const project = usePosterStore((s) => s.project);
  if (!project) return null;
  return (
    <input
      type="text"
      value={project.title}
      onChange={(e) =>
        usePosterStore.setState((s) => {
          if (s.project) s.project.title = e.target.value;
        })
      }
      placeholder="Untitled poster"
      className="bg-transparent text-[13px] font-medium text-zinc-300 outline-none focus:text-zinc-100 transition-colors w-40 truncate placeholder:text-zinc-700"
    />
  );
}

// ─── Canvas size menu ─────────────────────────────────────────────────────────

const CANVAS_SIZE_LABELS: Record<string, string> = {
  "a4":              "A4",
  "a3":              "A3",
  "instagram-post":  "Square",
  "instagram-story": "Story",
  "square":          "Square",
};

function CanvasSizeMenu() {
  const project      = usePosterStore((s) => s.project);
  const resizeCanvas = usePosterStore((s) => s.resizeCanvas);
  const [open, setOpen] = useState(false);
  if (!project) return null;

  const currentLabel = CANVAS_SIZE_LABELS[project.canvas.size] ?? project.canvas.size;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-200 transition-colors px-2 py-1 rounded-md border border-zinc-800 hover:border-zinc-600"
        title="Change canvas size"
      >
        {currentLabel}
        <span className="text-zinc-700 text-[10px]">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1.5 w-44 rounded-lg overflow-hidden z-50 border border-zinc-700/80"
            style={{ background: "#141416", boxShadow: "0 12px 32px rgba(0,0,0,0.6)" }}
          >
            {Object.entries(CANVAS_PRESETS).map(([key, cfg]) => {
              const active = project.canvas.size === key;
              return (
                <button
                  key={key}
                  onClick={() => { resizeCanvas(cfg); setOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 text-[12px] font-medium transition-colors flex justify-between items-center ${
                    active ? "text-zinc-100 bg-zinc-800/60" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
                  }`}
                >
                  <span>{CANVAS_SIZE_LABELS[key] ?? key}</span>
                  <span className="text-zinc-600 font-mono text-[10px]">{cfg.width}×{cfg.height}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Export menu ──────────────────────────────────────────────────────────────

function ExportMenu({ onPng, onJson }: { onPng: () => void; onJson: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="bg-white text-zinc-900 hover:bg-zinc-100 text-[12px] font-semibold px-3 py-1.5 rounded-md transition-colors flex items-center gap-1"
      >
        Export
        <span className="text-zinc-500 text-[10px]">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1.5 w-36 rounded-lg overflow-hidden z-50 border border-zinc-700/80"
            style={{ background: "#141416", boxShadow: "0 12px 32px rgba(0,0,0,0.6)" }}
          >
            {[
              { label: "PNG image",    fn: () => { setOpen(false); onPng(); } },
              { label: "JSON project", fn: () => { setOpen(false); onJson(); } },
            ].map(({ label, fn }) => (
              <button
                key={label}
                onClick={fn}
                className="w-full text-left px-3 py-2.5 text-[12px] font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── User menu ────────────────────────────────────────────────────────────────

function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  if (!session?.user) {
    return (
      <button
        onClick={() => signIn("google")}
        className="text-[11px] tracking-[0.06em] uppercase text-zinc-500 hover:text-zinc-200 transition-colors px-2 py-1 rounded"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >
        Sign in
      </button>
    );
  }

  const initials = session.user.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-6 h-6 rounded-full flex items-center justify-center font-mono text-[9px] text-zinc-300 overflow-hidden transition-colors"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)" }}
        title={session.user.email ?? ""}
      >
        {session.user.image
          ? <img src={session.user.image} alt="" className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
          : initials}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1.5 w-44 rounded-sm overflow-hidden z-50"
            style={{ background: "#141416", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 16px 40px rgba(0,0,0,0.6)" }}
          >
            <div className="px-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="text-[11px] text-zinc-200 truncate">{session.user.name}</div>
              <div className="text-[10px] text-zinc-500 truncate mt-0.5">{session.user.email}</div>
            </div>
            <button
              onClick={() => { setOpen(false); signOut(); }}
              className="w-full text-left px-3 py-2 text-[10px] tracking-wide uppercase text-zinc-500 hover:text-zinc-200 transition-colors"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Panel-level error boundary ───────────────────────────────────────────────

class PanelErrorBoundary extends Component<
  { children: ReactNode; name: string },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode; name: string }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`=== ${this.props.name} panel crash ===`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-3 flex flex-col gap-2">
          <p className="text-[10px] text-red-400/80">{this.props.name} error</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors text-left"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Editor-level error boundary ─────────────────────────────────────────────

class EditorErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("=== EditorClient render crash ===");
    console.error("Error:", error);
    console.error("Stack:", error.stack);
    console.error("Component stack:", info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-8">
          <p className="font-mono text-[11px] text-red-500/80 text-center max-w-lg">
            Editor crashed: {this.state.error.message}
          </p>
          <p className="font-mono text-[10px] text-zinc-600 text-center max-w-lg whitespace-pre-wrap">
            {this.state.error.stack?.split("\n").slice(0, 6).join("\n")}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="font-mono text-[10px] tracking-[0.15em] uppercase text-zinc-600 hover:text-zinc-300 border border-zinc-800 px-3 py-1.5 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export { EditorErrorBoundary };
