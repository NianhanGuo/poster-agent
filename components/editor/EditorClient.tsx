"use client";
import { useCallback, useEffect } from "react";
import { usePosterStore } from "@/store/posterStore";
import { PosterCanvas } from "./PosterCanvas";
import { LayerPanel } from "./LayerPanel";
import { ToolPanel } from "./ToolPanel";
import { AIToolbar } from "./AIToolbar";
import { PromptComposer } from "@/components/setup/PromptComposer";

export function EditorClient() {
  const { project, isGenerating, generatingStep } = usePosterStore();

  const handleExport = useCallback(() => {
    (window as Window & { __posterExport?: () => void }).__posterExport?.();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          usePosterStore.getState().redo();
        } else {
          usePosterStore.getState().undo();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!project) {
    return <PromptComposer />;
  }

  const isDemo = project.isDemo ?? false;

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex-none border-b border-zinc-900 px-5 h-10 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => usePosterStore.getState().clearProject()}
            className="font-mono text-[10px] tracking-[0.15em] uppercase text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            ← New
          </button>
          <span className="text-zinc-800">|</span>
          <TitleEditor />
        </div>

        <div className="flex items-center gap-5">
          {isDemo && (
            <span
              className="font-mono text-[10px] tracking-[0.1em] text-zinc-700"
              title="Add OPENAI_API_KEY for AI generation"
            >
              ○ demo
            </span>
          )}
          {isGenerating && (
            <span className="font-mono text-[10px] tracking-widest text-zinc-500 flex items-center gap-2">
              <span className="w-2.5 h-2.5 border border-zinc-600 border-t-zinc-300 rounded-full animate-spin inline-block" />
              {generatingStep || "working…"}
            </span>
          )}
          <button
            onClick={handleExport}
            className="font-mono text-[10px] tracking-[0.2em] uppercase text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            Export →
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Layer Panel */}
        <div className="w-52 flex-none border-r border-zinc-900 overflow-y-auto">
          <LayerPanel />
        </div>

        {/* Center: Canvas + AI bar */}
        <div className="flex-1 flex flex-col min-w-0">
          <AIToolbar />
          <div className="flex-1 overflow-auto bg-zinc-950 flex items-center justify-center p-8">
            <PosterCanvas />
          </div>
        </div>

        {/* Right: Inspector */}
        <div className="w-60 flex-none border-l border-zinc-900 overflow-y-auto">
          <ToolPanel />
        </div>
      </div>
    </div>
  );
}

function TitleEditor() {
  const project = usePosterStore((s) => s.project);
  if (!project) return null;

  return (
    <input
      type="text"
      value={project.title}
      onChange={(e) => {
        usePosterStore.setState((s) => {
          if (s.project) s.project.title = e.target.value;
        });
      }}
      className="bg-transparent font-mono text-[11px] tracking-wide text-zinc-400 border-none outline-none focus:text-zinc-200 transition-colors w-48 truncate"
    />
  );
}
