"use client";
import { useEffect, useCallback } from "react";
import Link from "next/link";
import { usePosterStore } from "@/store/posterStore";
import { PosterCanvas } from "./PosterCanvas";
import { LayerPanel } from "./LayerPanel";
import { ToolPanel } from "./ToolPanel";
import { AIToolbar } from "./AIToolbar";
import type { PosterProject } from "@/types/poster";

interface Props {
  initialProject: PosterProject;
  user: { name?: string | null; image?: string | null };
}

export function EditorClient({ initialProject, user }: Props) {
  const { setProject, project, isSaving, setSaving, isGenerating, generatingStep } =
    usePosterStore();

  useEffect(() => {
    setProject(initialProject);
  }, [initialProject, setProject]);

  const handleSave = useCallback(async () => {
    if (!project) return;
    setSaving(true);
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: project.title,
          canvas: project.canvas,
          layers: project.layers,
          stylePreset: project.stylePreset,
          posterType: project.posterType,
          language: project.language,
          promptHistory: project.promptHistory,
          lockedLayers: project.lockedLayers,
        }),
      });
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setSaving(false);
    }
  }, [project, setSaving]);

  // Auto-save on Ctrl+S / Cmd+S
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  if (!project) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex-none border-b border-zinc-800 bg-zinc-900 px-4 h-12 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
          >
            ← Dashboard
          </Link>
          <span className="text-zinc-600">|</span>
          <TitleEditor />
        </div>

        <div className="flex items-center gap-2">
          {isGenerating && (
            <span className="text-xs text-violet-400 flex items-center gap-1.5">
              <div className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full animate-spin" />
              {generatingStep || "Generating…"}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save"}
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
  const { project, updateLayer } = usePosterStore();
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
