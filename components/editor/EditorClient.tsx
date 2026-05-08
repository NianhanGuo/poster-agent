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
import { PromptComposer } from "@/components/setup/PromptComposer";
import type { DesignBrief, ReferenceTargets } from "@/types/poster";
import { CANVAS_PRESETS } from "@/types/poster";
import type { EnrichedRefCtx } from "@/lib/referencePrompt";

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

const PANEL_BG = "#0b0b0d";
const BORDER   = "rgba(255,255,255,0.07)";

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

  // ── 2-step generation: brief → layout + image ──────────────────────────────

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

    // Step 2: Layout
    setGenerating(true, "composing layout…");
    let layers: unknown[], imagePrompt: string;
    try {
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
        }),
      });
      if (!res.ok) throw new Error("layout failed");
      const data = await res.json();
      layers = data.layers;
      imagePrompt = data.imagePrompt;
    } catch {
      setGenError("Layout generation failed");
      setGenerating(false);
      return;
    }

    // Step 3: Image
    setGenerating(true, "generating image…");
    try {
      const imgRes = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        layers = (layers as { type: string; imageData?: Record<string, unknown> }[]).map((l) =>
          l.type === "backgroundImage"
            ? { ...l, imageData: { ...(l.imageData ?? {}), src: url } }
            : l,
        );
      }
    } catch {
      // Non-fatal — use layout without new image
    }

    const newProject = {
      ...project,
      layers: layers as typeof project.layers,
      promptHistory: promptOverride
        ? [...project.promptHistory, promptOverride]
        : project.promptHistory,
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
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: project.promptHistory.at(-1) ?? "",
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
    { id: "reference", label: "Ref" },
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
        className="flex-none h-12 flex items-center gap-3 px-4 z-20"
        style={{ background: "rgba(0,0,0,0.75)", borderBottom: `1px solid ${BORDER}`, backdropFilter: "blur(20px)" }}
      >
        {/* Left: back + title */}
        <div className="flex items-center gap-3 flex-none">
          <button
            onClick={() => usePosterStore.getState().clearProject()}
            className="text-[11px] tracking-[0.08em] uppercase text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            ← New
          </button>
          <span style={{ color: "rgba(255,255,255,0.1)" }}>|</span>
          <TitleEditor />
        </div>

        {/* Center: mode + prompt input */}
        <div className="flex-1 flex items-center gap-2 mx-2">
          {/* Generation mode pills */}
          <div
            className="flex-none flex gap-px rounded-md overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.09)" }}
          >
            {([ ["full", "Layout"], ["image", "Image"], ["type", "Type"] ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setGenMode(id)}
                className="px-2.5 h-7 text-[10px] tracking-[0.04em] uppercase transition-colors"
                style={{
                  background: genMode === id ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.02)",
                  color: genMode === id ? "#f0f0f2" : "#71717a",
                  borderRight: id !== "type" ? "1px solid rgba(255,255,255,0.08)" : "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Prompt input */}
          <div
            className="flex-1 flex items-center gap-2 h-7 rounded-md px-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              placeholder={
                genMode === "image" ? "Image style hint (optional)…"
                : genMode === "type"  ? "Type style hint, e.g. 'cinematic'…"
                : "Describe a change, mood, or direction…"
              }
              disabled={isGenerating}
              className="flex-1 bg-transparent text-[11px] text-zinc-200 placeholder:text-zinc-500 outline-none disabled:opacity-40"
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-none text-[11px] tracking-[0.06em] uppercase text-zinc-400 hover:text-zinc-100 disabled:opacity-30 transition-colors pl-2 ml-0.5"
              style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }}
            >
              {genMode === "full" ? "Generate" : genMode === "image" ? "Regen Image" : "Retype"}
            </button>
          </div>
        </div>

        {/* Right: brief + status + export + user */}
        <div className="flex items-center gap-4 flex-none">
          {/* Current design brief mood */}
          {designBrief && !isGenerating && (
            <span
              className="text-[10px] text-zinc-500 italic max-w-[120px] truncate hidden lg:block"
              title={designBrief.designRationale}
            >
              {designBrief.mood}
            </span>
          )}

          {isDemo && (
            <span className="text-[10px] text-zinc-500" title="Add OPENAI_API_KEY for AI generation">
              ○ demo
            </span>
          )}
          {isGenerating && (
            <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-zinc-600 border-t-zinc-300 animate-spin inline-block" />
              {generatingStep}
            </span>
          )}
          {genError && !isGenerating && (
            <span className="text-[11px] text-red-400/90">{genError}</span>
          )}

          {/* Canvas size */}
          <CanvasSizeMenu />

          {/* Export dropdown */}
          <ExportMenu onPng={handleExport} onJson={exportJSON} />

          <PanelErrorBoundary name="UserMenu"><UserMenu /></PanelErrorBoundary>
        </div>
      </header>

      {/* ── AI usage feedback strip ──────────────────────────────────────────── */}
      {aiUsedLabel && (
        <div
          className="flex-none h-6 flex items-center px-4 gap-2"
          style={{ background: "rgba(74,222,128,0.04)", borderBottom: "1px solid rgba(74,222,128,0.12)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400/60 flex-none" />
          <span className="text-[10px] text-green-400/80 tracking-wide">AI used: {aiUsedLabel}</span>
        </div>
      )}


      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">

        {/* Left sidebar */}
        <aside
          className="w-56 flex-none flex flex-col"
          style={{ background: PANEL_BG, borderRight: `1px solid ${BORDER}` }}
        >
          <div className="flex-none flex" style={{ borderBottom: `1px solid ${BORDER}` }}>
            {LEFT_TABS.map(({ id, label }) => {
              const isRef = id === "reference";
              const refCount = isRef ? (reference.images ?? []).length : 0;
              return (
                <button
                  key={id}
                  onClick={() => setLeftTab(id)}
                  className={`flex-1 py-2.5 text-[10px] tracking-[0.08em] uppercase transition-colors relative ${
                    leftTab === id ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {label}
                    {isRef && refCount > 0 && (
                      <span
                        className="w-3.5 h-3.5 rounded-full font-mono text-[7px] flex items-center justify-center"
                        style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}
                      >
                        {refCount}
                      </span>
                    )}
                  </span>
                  {leftTab === id && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-px"
                      style={{ background: "rgba(161,161,170,0.6)" }}
                    />
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
          <div
            className="flex-none h-8 flex items-center px-3 gap-0"
            style={{ borderBottom: `1px solid rgba(255,255,255,0.05)`, background: "rgba(0,0,0,0.25)" }}
          >
            {/* Quick generation actions */}
            {QUICK_ACTIONS.map((a, i) => (
              <span key={a.label} className="flex items-center">
                {i > 0 && <span className="mx-2.5" style={{ color: "#27272a" }}>·</span>}
                <button
                  onClick={a.fn}
                  disabled={isGenerating}
                  className="text-[10px] tracking-[0.06em] uppercase text-zinc-500 hover:text-zinc-200 disabled:opacity-30 transition-colors"
                >
                  {a.label}
                </button>
              </span>
            ))}

            {/* Separator */}
            <span className="mx-3" style={{ color: "#27272a" }}>|</span>

            {/* Alignment tools */}
            <AlignmentBar />

            {/* Guide toggle */}
            <span className="mx-2" style={{ color: "#27272a" }}>|</span>
            <button
              onClick={() => setShowGuides((g) => !g)}
              title="Toggle safe margin guides"
              className="text-[10px] tracking-wide uppercase transition-colors"
              style={{ color: showGuides ? "#a1a1aa" : "#52525b" }}
            >
              guides
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
          className="w-60 flex-none overflow-y-auto"
          style={{ background: PANEL_BG, borderLeft: `1px solid ${BORDER}` }}
        >
          <PanelErrorBoundary name="ToolPanel"><ToolPanel onTypography={runTypography} onEditImage={setEditImageLayerId} /></PanelErrorBoundary>
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
      className="bg-transparent text-[13px] tracking-wide text-zinc-300 outline-none focus:text-zinc-100 transition-colors w-44 truncate"
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
        className="text-[10px] tracking-[0.08em] uppercase text-zinc-500 hover:text-zinc-200 transition-colors flex items-center gap-1"
        style={{ border: "1px solid rgba(255,255,255,0.09)", padding: "3px 8px", borderRadius: 4 }}
        title="Change canvas size"
      >
        {currentLabel}
        <span style={{ opacity: 0.4 }}>▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1.5 w-44 rounded-sm overflow-hidden z-50"
            style={{ background: "#141416", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 12px 32px rgba(0,0,0,0.6)" }}
          >
            {Object.entries(CANVAS_PRESETS).map(([key, cfg]) => {
              const active = project.canvas.size === key;
              return (
                <button
                  key={key}
                  onClick={() => { resizeCanvas(cfg); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-[10px] transition-colors flex justify-between items-center"
                  style={{
                    color: active ? "#f0f0f2" : "#a1a1aa",
                    background: active ? "rgba(255,255,255,0.07)" : "transparent",
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = "#e4e4e7"; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = "#a1a1aa"; }}
                >
                  <span>{CANVAS_SIZE_LABELS[key] ?? key}</span>
                  <span style={{ opacity: 0.4 }}>{cfg.width}×{cfg.height}</span>
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
        className="text-[11px] tracking-[0.1em] uppercase text-zinc-400 hover:text-zinc-100 transition-colors"
      >
        Export →
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1.5 w-32 rounded-sm overflow-hidden z-50"
            style={{ background: "#141416", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 12px 32px rgba(0,0,0,0.6)" }}
          >
            {[
              { label: "PNG image",    fn: () => { setOpen(false); onPng(); } },
              { label: "JSON project", fn: () => { setOpen(false); onJson(); } },
            ].map(({ label, fn }) => (
              <button
                key={label}
                onClick={fn}
                className="w-full text-left px-3 py-2 text-[10px] text-zinc-400 hover:text-zinc-100 transition-colors"
                style={{ display: "block" }}
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
