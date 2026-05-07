"use client";
import { useState, useCallback, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { usePosterStore } from "@/store/posterStore";
import { PosterCanvas } from "./PosterCanvas";
import { LayerPanel } from "./LayerPanel";
import { ToolPanel } from "./ToolPanel";
import { AssetLibrary } from "./AssetLibrary";
import { ReferencePanel } from "./ReferencePanel";
import { VersionStrip } from "./VersionStrip";
import { AlignmentBar } from "./AlignmentBar";
import { PromptComposer } from "@/components/setup/PromptComposer";
import type { DesignBrief } from "@/types/poster";
import type { Session } from "next-auth";

type LeftTab = "layers" | "assets" | "reference";

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

  const { data: session } = useSession();
  const [leftTab, setLeftTab] = useState<LeftTab>("layers");
  const [command, setCommand] = useState("");
  const [genError, setGenError] = useState("");
  const [showGuides, setShowGuides] = useState(false);

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
  const refCtx = {
    strength: reference.strength,
    targets: reference.targets,
    instruction: reference.instruction,
    hasImage: !!reference.imageUrl,
  };

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
          canvasWidth: project.canvas.width,
          canvasHeight: project.canvas.height,
        }),
      });
      if (!res.ok) throw new Error();
      const { layers } = await res.json();
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
    await runGeneration(cmd || undefined);
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
            className="font-mono text-[10px] tracking-[0.2em] uppercase text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            ← New
          </button>
          <span style={{ color: "rgba(255,255,255,0.1)" }}>|</span>
          <TitleEditor />
        </div>

        {/* Center: prompt input */}
        <div className="flex-1 flex items-center mx-2">
          <div
            className="flex-1 flex items-center gap-2 h-7 rounded-md px-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              placeholder="Describe a change, mood, or direction…"
              disabled={isGenerating}
              className="flex-1 bg-transparent font-mono text-[10px] text-zinc-300 placeholder:text-zinc-700 outline-none disabled:opacity-40"
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-none font-mono text-[10px] tracking-[0.15em] uppercase text-zinc-400 hover:text-zinc-100 disabled:opacity-30 transition-colors pl-2 ml-0.5"
              style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }}
            >
              Generate
            </button>
          </div>
        </div>

        {/* Right: brief + status + export + user */}
        <div className="flex items-center gap-4 flex-none">
          {/* Current design brief mood */}
          {designBrief && !isGenerating && (
            <span
              className="font-mono text-[9px] text-zinc-600 italic max-w-[120px] truncate hidden lg:block"
              title={designBrief.designRationale}
            >
              {designBrief.mood}
            </span>
          )}

          {isDemo && (
            <span className="font-mono text-[10px] text-zinc-700" title="Add OPENAI_API_KEY for AI generation">
              ○ demo
            </span>
          )}
          {isGenerating && (
            <span className="font-mono text-[10px] text-zinc-500 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-zinc-600 border-t-zinc-300 animate-spin inline-block" />
              {generatingStep}
            </span>
          )}
          {genError && !isGenerating && (
            <span className="font-mono text-[10px] text-red-500/80">{genError}</span>
          )}

          {/* Export dropdown */}
          <ExportMenu onPng={handleExport} onJson={exportJSON} />

          <UserMenu session={session} />
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">

        {/* Left sidebar */}
        <aside
          className="w-52 flex-none flex flex-col"
          style={{ background: PANEL_BG, borderRight: `1px solid ${BORDER}` }}
        >
          <div className="flex-none flex" style={{ borderBottom: `1px solid ${BORDER}` }}>
            {LEFT_TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setLeftTab(id)}
                className={`flex-1 py-2.5 font-mono text-[9px] tracking-[0.18em] uppercase transition-colors relative ${
                  leftTab === id ? "text-zinc-200" : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {label}
                {leftTab === id && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-px"
                    style={{ background: "rgba(161,161,170,0.7)" }}
                  />
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {leftTab === "layers"    && <LayerPanel />}
            {leftTab === "assets"    && <AssetLibrary />}
            {leftTab === "reference" && <ReferencePanel />}
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
                  className="font-mono text-[9px] tracking-[0.12em] uppercase text-zinc-600 hover:text-zinc-300 disabled:opacity-30 transition-colors"
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
              className="font-mono text-[9px] tracking-wide uppercase transition-colors"
              style={{ color: showGuides ? "#a1a1aa" : "#3f3f46" }}
            >
              guides
            </button>
          </div>

          {/* Canvas */}
          <div
            className="flex-1 overflow-auto flex items-center justify-center p-8"
            style={{ background: "#050507" }}
          >
            <PosterCanvas showGuides={showGuides} />
          </div>

          {/* Version strip */}
          <VersionStrip />
        </main>

        {/* Right inspector */}
        <aside
          className="w-60 flex-none overflow-y-auto"
          style={{ background: PANEL_BG, borderLeft: `1px solid ${BORDER}` }}
        >
          <ToolPanel onTypography={runTypography} />
        </aside>
      </div>
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
      className="bg-transparent font-mono text-[11px] tracking-wide text-zinc-400 outline-none focus:text-zinc-200 transition-colors w-40 truncate"
    />
  );
}

// ─── Export menu ──────────────────────────────────────────────────────────────

function ExportMenu({ onPng, onJson }: { onPng: () => void; onJson: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="font-mono text-[10px] tracking-[0.2em] uppercase text-zinc-500 hover:text-zinc-200 transition-colors"
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
                className="w-full text-left px-3 py-2 font-mono text-[9px] tracking-wide text-zinc-400 hover:text-zinc-200 transition-colors"
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

type NextSession = Session | null;

function UserMenu({ session }: { session: NextSession }) {
  const [open, setOpen] = useState(false);

  if (!session?.user) {
    return (
      <button
        onClick={() => signIn("google")}
        className="font-mono text-[10px] tracking-[0.15em] uppercase text-zinc-600 hover:text-zinc-300 transition-colors px-2 py-0.5 rounded-sm"
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
              <div className="font-mono text-[10px] text-zinc-200 truncate">{session.user.name}</div>
              <div className="font-mono text-[8px] text-zinc-600 truncate mt-0.5">{session.user.email}</div>
            </div>
            <button
              onClick={() => { setOpen(false); signOut(); }}
              className="w-full text-left px-3 py-2 font-mono text-[9px] tracking-wide uppercase text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
