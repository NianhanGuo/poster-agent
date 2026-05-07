"use client";
import { useState, useCallback, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { usePosterStore } from "@/store/posterStore";
import { PosterCanvas } from "./PosterCanvas";
import { LayerPanel } from "./LayerPanel";
import { ToolPanel } from "./ToolPanel";
import { AssetLibrary } from "./AssetLibrary";
import { ReferencePanel } from "./ReferencePanel";
import { PromptComposer } from "@/components/setup/PromptComposer";
import type { Session } from "next-auth";

type LeftTab = "layers" | "assets" | "reference";

// ─── Shared glass token ────────────────────────────────────────────────────────
const PANEL_BG  = "#0b0b0d";
const BORDER    = "rgba(255,255,255,0.07)";
const HEADER_BG = "rgba(0,0,0,0.75)";

export function EditorClient() {
  const {
    project,
    isGenerating,
    generatingStep,
    setGenerating,
    setProject,
    getSortedLayers,
    reference,
  } = usePosterStore();

  const { data: session } = useSession();
  const [leftTab, setLeftTab] = useState<LeftTab>("layers");
  const [command, setCommand] = useState("");
  const [genError, setGenError] = useState("");

  const handleExport = useCallback(() => {
    (window as Window & { __posterExport?: () => void }).__posterExport?.();
  }, []);

  // Undo / Redo
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "z") {
          e.preventDefault();
          if (e.shiftKey) usePosterStore.getState().redo();
          else usePosterStore.getState().undo();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!project) return <PromptComposer />;

  const isDemo = project.isDemo ?? false;
  const lockedLayers = getSortedLayers().filter((l) => l.locked);

  // Reference context forwarded to AI routes
  const refCtx = {
    strength: reference.strength,
    targets: reference.targets,
    instruction: reference.instruction,
    hasImage: !!reference.imageUrl,
  };

  // ── AI actions ────────────────────────────────────────────────────────────

  async function runLayout(promptOverride?: string) {
    if (!project) return;
    setGenerating(true, "generating layout…");
    setGenError("");
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
          reference: refCtx,
        }),
      });
      if (!res.ok) throw new Error();
      const { layers, imagePrompt } = await res.json();

      setGenerating(true, "generating image…");
      const imgRes = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imagePrompt,
          styleRecipe: project.styleRecipe,
          width: project.canvas.width,
          height: project.canvas.height,
          reference: refCtx,
        }),
      });
      const { url } = await imgRes.json();
      const finalLayers = layers.map(
        (l: { type: string; imageData?: Record<string, unknown> }) =>
          l.type === "backgroundImage" && url
            ? { ...l, imageData: { ...l.imageData, src: url } }
            : l,
      );
      setProject({ ...project, layers: finalLayers });
    } catch {
      setGenError("Generation failed");
    } finally {
      setGenerating(false);
    }
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
      setProject({ ...project, layers });
    } catch {
      setGenError("Image failed");
    } finally {
      setGenerating(false);
    }
  }

  async function improveTypography() {
    if (!project) return;
    setGenerating(true, "refining type…");
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
          reference: refCtx,
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
    await runLayout(cmd || undefined);
  }

  const LEFT_TABS: { id: LeftTab; label: string }[] = [
    { id: "layers",    label: "Layers" },
    { id: "assets",    label: "Assets" },
    { id: "reference", label: "Ref" },
  ];

  const QUICK_ACTIONS = [
    { label: "Regenerate", fn: () => runLayout() },
    { label: "Image",      fn: regenerateImage },
    { label: "Type",       fn: improveTypography },
    { label: "Variation",  fn: () => runLayout(`Variation: ${project.promptHistory.at(-1) ?? ""}`) },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#080808", color: "#e4e4e7" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header
        className="flex-none h-12 flex items-center gap-3 px-4 z-20"
        style={{ background: HEADER_BG, borderBottom: `1px solid ${BORDER}`, backdropFilter: "blur(20px)" }}
      >
        {/* Left: back + separator + title */}
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
              placeholder="Describe a change and press Generate…"
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

        {/* Right: status + export + user */}
        <div className="flex items-center gap-4 flex-none">
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
          <button
            onClick={handleExport}
            className="font-mono text-[10px] tracking-[0.2em] uppercase text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            Export →
          </button>
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
          {/* Tab bar */}
          <div
            className="flex-none flex"
            style={{ borderBottom: `1px solid ${BORDER}` }}
          >
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

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {leftTab === "layers"    && <LayerPanel />}
            {leftTab === "assets"    && <AssetLibrary />}
            {leftTab === "reference" && <ReferencePanel />}
          </div>
        </aside>

        {/* Center: quick-action bar + canvas */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Quick actions */}
          <div
            className="flex-none h-8 flex items-center px-4 gap-0"
            style={{ borderBottom: `1px solid rgba(255,255,255,0.05)`, background: "rgba(0,0,0,0.3)" }}
          >
            {QUICK_ACTIONS.map((a, i) => (
              <span key={a.label} className="flex items-center">
                {i > 0 && <span className="mx-3" style={{ color: "#27272a" }}>·</span>}
                <button
                  onClick={a.fn}
                  disabled={isGenerating}
                  className="font-mono text-[9px] tracking-[0.15em] uppercase text-zinc-600 hover:text-zinc-300 disabled:opacity-30 transition-colors"
                >
                  {a.label}
                </button>
              </span>
            ))}
          </div>

          {/* Canvas area */}
          <div
            className="flex-1 overflow-auto flex items-center justify-center p-8"
            style={{ background: "#050507" }}
          >
            <PosterCanvas />
          </div>
        </main>

        {/* Right inspector */}
        <aside
          className="w-60 flex-none overflow-y-auto"
          style={{ background: PANEL_BG, borderLeft: `1px solid ${BORDER}` }}
        >
          <ToolPanel />
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

// ─── User menu ────────────────────────────────────────────────────────────────

type NextSession = Session | null;

function UserMenu({ session }: { session: NextSession }) {
  const [open, setOpen] = useState(false);
  const hasGoogleAuth = !!process.env.NEXT_PUBLIC_HAS_GOOGLE_AUTH;

  if (!session?.user) {
    return (
      <button
        onClick={() => signIn("google")}
        className="font-mono text-[10px] tracking-[0.15em] uppercase text-zinc-600 hover:text-zinc-300 transition-colors px-2 py-0.5 rounded-sm"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        title={hasGoogleAuth ? "Sign in with Google" : "Google auth not configured"}
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
        className="w-6 h-6 rounded-full flex items-center justify-center font-mono text-[9px] text-zinc-300 transition-colors overflow-hidden"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)" }}
        title={session.user.email ?? ""}
      >
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="w-full h-full object-cover" />
        ) : (
          initials
        )}
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
              style={{ background: "transparent" }}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
