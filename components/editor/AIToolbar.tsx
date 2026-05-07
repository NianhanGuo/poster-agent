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
    reference,
  } = usePosterStore();
  const [command, setCommand] = useState("");
  const [error, setError] = useState("");

  if (!project) return null;

  const lockedLayers = getSortedLayers().filter((l) => l.locked);

  // Build reference context from store — passed to every AI call
  function buildRefCtx() {
    const anyTarget = Object.values(reference.targets).some(Boolean);
    if (!anyTarget && !reference.instruction) return undefined;
    return {
      strength: reference.strength,
      targets: reference.targets,
      palette: reference.palette.length > 0 ? reference.palette : undefined,
      analysis: reference.analysis ?? undefined,
      instruction: reference.instruction || undefined,
    };
  }

  async function runLayout(promptOverride?: string) {
    if (!project) return;
    setGenerating(true, "regenerating…");
    setError("");
    const refCtx = buildRefCtx();
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
            prompt: promptOverride ?? project.promptHistory[project.promptHistory.length - 1] ?? "",
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
      const imgData = await imgRes.json();

      const finalLayers = layers.map(
        (l: { type: string; imageData?: Record<string, unknown> }) =>
          l.type === "backgroundImage" && imgData.url
            ? { ...l, imageData: { ...l.imageData, src: imgData.url } }
            : l
      );
      setProject({ ...project, layers: finalLayers });
    } catch {
      setError("failed");
    } finally {
      setGenerating(false);
    }
  }

  async function regenerateImage() {
    if (!project) return;
    setGenerating(true, "generating image…");
    setError("");
    const refCtx = buildRefCtx();
    try {
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: project.promptHistory[project.promptHistory.length - 1] ?? "",
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
          : l
      );
      setProject({ ...project, layers });
    } catch {
      setError("failed");
    } finally {
      setGenerating(false);
    }
  }

  async function improveTypography() {
    if (!project) return;
    setGenerating(true, "refining type…");
    setError("");
    const refCtx = buildRefCtx();
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
      setError("failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCommand() {
    if (!command.trim()) return;
    const cmd = command.trim();
    setCommand("");
    await runLayout(cmd);
  }

  const actions: { label: string; fn: () => void }[] = [
    { label: "Regenerate", fn: () => runLayout() },
    { label: "Image", fn: regenerateImage },
    { label: "Type", fn: improveTypography },
    { label: "Variation", fn: () => runLayout(`Create a different composition: ${project.promptHistory[project.promptHistory.length - 1] ?? ""}`) },
  ];

  const hasRef = !!reference.imageUrl || reference.analysis != null;

  return (
    <div className="flex-none border-b border-zinc-900 px-5 h-9 flex items-center gap-4">
      {/* Natural language command */}
      <input
        type="text"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleCommand()}
        placeholder="Describe a change…"
        className="flex-1 bg-transparent font-mono text-[10px] tracking-wide text-zinc-400 placeholder:text-zinc-700 outline-none"
      />

      {/* Reference active indicator */}
      {hasRef && (
        <span
          className="font-mono text-[8px] tracking-wide uppercase text-zinc-600 flex-none"
          title={`Reference active — ${Object.entries(reference.targets).filter(([,v])=>v).map(([k])=>k).join(", ")}`}
        >
          ref ●
        </span>
      )}

      {/* Action links */}
      <div className="flex items-center gap-0">
        {actions.map((a, i) => (
          <span key={a.label} className="flex items-center">
            {i > 0 && <span className="text-zinc-800 mx-2">·</span>}
            <button
              onClick={a.fn}
              disabled={isGenerating}
              className="font-mono text-[10px] tracking-[0.12em] uppercase text-zinc-600 hover:text-zinc-300 disabled:opacity-30 transition-colors"
            >
              {a.label}
            </button>
          </span>
        ))}
      </div>

      {error && (
        <span className="font-mono text-[10px] text-red-600">{error}</span>
      )}
    </div>
  );
}
