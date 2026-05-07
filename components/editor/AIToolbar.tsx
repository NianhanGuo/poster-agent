"use client";
import { useState } from "react";
import { usePosterStore } from "@/store/posterStore";

export function AIToolbar() {
  const {
    project,
    setProject,
    setGenerating,
    isGenerating,
    getSortedLayers,
  } = usePosterStore();
  const [error, setError] = useState("");

  if (!project) return null;

  const lockedLayers = getSortedLayers().filter((l) => l.locked);
  const unlockedIds = new Set(
    getSortedLayers()
      .filter((l) => !l.locked)
      .map((l) => l.id)
  );

  async function regenerateAll() {
    if (!project) return;
    setGenerating(true, "Regenerating layout…");
    setError("");
    try {
      const res = await fetch("/api/generate/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setup: {
            posterType: project.posterType,
            canvasSize: project.canvas.size,
            language: project.language,
            stylePreset: project.stylePreset,
            prompt: project.promptHistory[project.promptHistory.length - 1] ?? "",
            aiWriteCopy: true,
          },
          lockedLayers,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const { layers, imagePrompt } = await res.json();

      setGenerating(true, "Generating image…");
      const imgRes = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imagePrompt,
          style: project.stylePreset,
          width: project.canvas.width,
          height: project.canvas.height,
        }),
      });
      const imgData = await imgRes.json();

      const finalLayers = layers.map(
        (l: { type: string; imageData?: Record<string, unknown> }) => {
          if (l.type === "background-image" && imgData.url) {
            return { ...l, imageData: { ...l.imageData, src: imgData.url } };
          }
          return l;
        }
      );

      setProject({ ...project, layers: finalLayers });
    } catch (e) {
      console.error(e);
      setError("Regeneration failed");
    } finally {
      setGenerating(false);
    }
  }

  async function regenerateImageOnly() {
    if (!project) return;
    setGenerating(true, "Regenerating image…");
    setError("");
    try {
      const prompt =
        project.promptHistory[project.promptHistory.length - 1] ?? "";
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          style: project.stylePreset,
          width: project.canvas.width,
          height: project.canvas.height,
        }),
      });
      const { url } = await res.json();
      if (!url) {
        setError("Image generation unavailable — configure REPLICATE_API_TOKEN");
        return;
      }

      const layers = project.layers.map((l) => {
        if (l.type === "background-image" && !l.locked) {
          return { ...l, imageData: { ...l.imageData, src: url } };
        }
        return l;
      });

      setProject({ ...project, layers });
    } catch (e) {
      console.error(e);
      setError("Image regeneration failed");
    } finally {
      setGenerating(false);
    }
  }

  async function improveTypography() {
    if (!project) return;
    setGenerating(true, "Improving typography…");
    setError("");
    try {
      const res = await fetch("/api/generate/typography", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layers: project.layers,
          style: project.stylePreset,
          posterType: project.posterType,
          language: project.language,
          lockedLayers: lockedLayers.map((l) => l.id),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const { layers } = await res.json();
      setProject({ ...project, layers });
    } catch (e) {
      console.error(e);
      setError("Typography improvement failed");
    } finally {
      setGenerating(false);
    }
  }

  async function improveLayout() {
    if (!project) return;
    setGenerating(true, "Optimizing layout…");
    setError("");
    try {
      const res = await fetch("/api/generate/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setup: {
            posterType: project.posterType,
            canvasSize: project.canvas.size,
            language: project.language,
            stylePreset: project.stylePreset,
            prompt: `Improve and refine this layout: ${project.promptHistory[project.promptHistory.length - 1] ?? ""}`,
            aiWriteCopy: false,
          },
          lockedLayers,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const { layers } = await res.json();

      // Preserve locked layers and merge
      const merged = layers.map(
        (l: { id: string }) =>
          lockedLayers.find((ll) => ll.id === l.id) ?? l
      );
      setProject({ ...project, layers: merged });
    } catch (e) {
      console.error(e);
      setError("Layout improvement failed");
    } finally {
      setGenerating(false);
    }
  }

  async function createVariation() {
    if (!project) return;
    setGenerating(true, "Creating variation…");
    setError("");
    try {
      const res = await fetch("/api/generate/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setup: {
            posterType: project.posterType,
            canvasSize: project.canvas.size,
            language: project.language,
            stylePreset: project.stylePreset,
            prompt: `Create a variation with different composition: ${project.promptHistory[project.promptHistory.length - 1] ?? ""}`,
            aiWriteCopy: true,
          },
          lockedLayers,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const { layers, imagePrompt } = await res.json();

      const imgRes = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imagePrompt,
          style: project.stylePreset,
          width: project.canvas.width,
          height: project.canvas.height,
        }),
      });
      const imgData = await imgRes.json();

      const finalLayers = layers.map(
        (l: { type: string; imageData?: Record<string, unknown> }) => {
          if (l.type === "background-image" && imgData.url) {
            return { ...l, imageData: { ...l.imageData, src: imgData.url } };
          }
          return l;
        }
      );

      setProject({ ...project, layers: finalLayers });
    } catch (e) {
      console.error(e);
      setError("Variation creation failed");
    } finally {
      setGenerating(false);
    }
  }

  const buttons = [
    { label: "Regenerate All", action: regenerateAll, color: "violet" },
    { label: "New Image", action: regenerateImageOnly, color: "blue" },
    { label: "Typography", action: improveTypography, color: "emerald" },
    { label: "Layout", action: improveLayout, color: "amber" },
    { label: "Variation", action: createVariation, color: "pink" },
  ];

  const colorMap: Record<string, string> = {
    violet:
      "bg-violet-900/40 hover:bg-violet-800/60 text-violet-300 border-violet-800/60",
    blue: "bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 border-blue-800/60",
    emerald:
      "bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 border-emerald-800/60",
    amber:
      "bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 border-amber-800/60",
    pink: "bg-pink-900/40 hover:bg-pink-800/60 text-pink-300 border-pink-800/60",
  };

  return (
    <div className="flex-none border-b border-zinc-800 bg-zinc-900/50 px-4 py-2 flex items-center gap-2">
      <span className="text-xs text-zinc-500 font-medium mr-1">AI:</span>
      {buttons.map((btn) => (
        <button
          key={btn.label}
          onClick={btn.action}
          disabled={isGenerating}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${colorMap[btn.color]}`}
        >
          {btn.label}
        </button>
      ))}
      {lockedLayers.length > 0 && (
        <span className="text-xs text-zinc-600 ml-1">
          ({lockedLayers.length} locked)
        </span>
      )}
      {error && (
        <span className="text-xs text-red-400 ml-2">{error}</span>
      )}
    </div>
  );
}
