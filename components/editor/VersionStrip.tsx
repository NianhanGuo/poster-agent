"use client";
import { usePosterStore } from "@/store/posterStore";
import { RECIPES } from "@/lib/styleRecipes";
import type { StyleRecipe } from "@/types/poster";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function VersionStrip() {
  const { projectVersions, currentVersionIndex, restoreVersion } = usePosterStore();

  if (projectVersions.length === 0) return null;

  return (
    <div
      className="flex-none flex items-center gap-2 px-4 overflow-x-auto"
      style={{
        height: "64px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "#040406",
        scrollbarWidth: "none",
      }}
    >
      <span className="font-mono text-[8px] tracking-[0.25em] uppercase text-zinc-700 flex-none pr-1">
        Versions
      </span>

      {projectVersions.map((v, i) => {
        const recipe = RECIPES[(v.project.styleRecipe as StyleRecipe)] ?? RECIPES["cinematic-rain"];
        const isCurrent = i === currentVersionIndex;
        const mood = v.brief?.mood;

        return (
          <button
            key={i}
            onClick={() => restoreVersion(i)}
            title={`${mood ?? recipe.name}\n${new Date(v.timestamp).toLocaleTimeString()}`}
            className="flex-none flex flex-col items-start gap-1 px-2.5 py-1.5 rounded-sm transition-all"
            style={{
              minWidth: "72px",
              background: isCurrent ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${isCurrent ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            {/* Color gradient swatch from recipe palette */}
            <div
              className="w-full h-3 rounded-sm"
              style={{
                background: `linear-gradient(90deg, ${recipe.palette.bg} 0%, ${recipe.palette.accent} 60%, ${recipe.palette.text}33 100%)`,
              }}
            />
            <div className="flex items-baseline gap-1 w-full">
              <span
                className="font-mono text-[9px] flex-none"
                style={{ color: isCurrent ? "#a1a1aa" : "#52525b" }}
              >
                v{i + 1}
              </span>
              {mood ? (
                <span
                  className="font-mono text-[8px] truncate flex-1"
                  style={{ color: isCurrent ? "#71717a" : "#3f3f46" }}
                >
                  {mood}
                </span>
              ) : (
                <span
                  className="font-mono text-[8px] truncate flex-1"
                  style={{ color: isCurrent ? "#71717a" : "#3f3f46" }}
                >
                  {recipe.name}
                </span>
              )}
              <span className="font-mono text-[7px] flex-none" style={{ color: "#3f3f46" }}>
                {relativeTime(v.timestamp)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
