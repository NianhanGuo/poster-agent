"use client";
import { useCallback, useEffect } from "react";
import { usePosterStore } from "@/store/posterStore";
import { PosterCanvas } from "./PosterCanvas";
import { LayerPanel } from "./LayerPanel";
import { ToolPanel } from "./ToolPanel";
import { AIToolbar } from "./AIToolbar";
import { PosterSetupModal } from "@/components/setup/PosterSetupModal";

export function EditorClient() {
  const { project, isGenerating, generatingStep } = usePosterStore();

  const handleExport = useCallback(() => {
    (window as Window & { __posterExport?: () => void }).__posterExport?.();
  }, []);

  // Undo/Redo keyboard shortcuts
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

  // No project yet — show setup wizard
  if (!project) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <PosterSetupModal />
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex-none border-b border-zinc-800 bg-zinc-900 px-4 h-12 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => usePosterStore.getState().clearProject()}
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
            title="Start over"
          >
            ← New Poster
          </button>
          <span className="text-zinc-600">|</span>
          <TitleEditor />
        </div>

        <div className="flex items-center gap-3">
          {isGenerating && (
            <span className="text-xs text-violet-400 flex items-center gap-1.5">
              <span className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full animate-spin inline-block" />
              {generatingStep || "Generating…"}
            </span>
          )}
          <button
            onClick={handleExport}
            className="text-sm bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            Export PNG
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Layer Panel */}
        <div className="w-56 flex-none border-r border-zinc-800 bg-zinc-900 overflow-y-auto">
          <LayerPanel />
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 flex flex-col min-w-0">
          <AIToolbar />
          <div className="flex-1 overflow-auto bg-zinc-950 flex items-center justify-center p-8">
            <PosterCanvas />
          </div>
        </div>

        {/* Right: Tool Panel */}
        <div className="w-64 flex-none border-l border-zinc-800 bg-zinc-900 overflow-y-auto">
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
      className="bg-transparent text-sm font-medium text-white border-none outline-none focus:bg-zinc-800 px-2 py-1 rounded"
    />
  );
}
