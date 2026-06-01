"use client";
import { useState } from "react";
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
  const [showPopover, setShowPopover] = useState(false);

  if (projectVersions.length === 0) return null;

  return (
    <div className="flex-none h-8 flex items-center px-3 gap-3 bg-zinc-950 border-t border-zinc-800/60">
      <span className="text-[11px] font-medium text-zinc-600 flex-none">History</span>

      {/* Dot indicators */}
      <div className="flex items-center gap-1.5">
        {projectVersions.map((v, i) => {
          const isCurrent = i === currentVersionIndex;
          return (
            <button
              key={i}
              onClick={() => restoreVersion(i)}
              title={`v${i + 1}${v.brief?.mood ? ` — ${v.brief.mood}` : ""}\n${new Date(v.timestamp).toLocaleTimeString()}`}
              className={`rounded-full transition-all duration-150 ${
                isCurrent
                  ? "w-2 h-2 bg-zinc-200"
                  : "w-1.5 h-1.5 bg-zinc-600 hover:bg-zinc-400"
              }`}
            />
          );
        })}
      </div>

      {/* Current version label */}
      <span className="text-[11px] font-mono text-zinc-600">
        v{currentVersionIndex + 1}
        {projectVersions[currentVersionIndex]?.brief?.mood && (
          <span className="text-zinc-700 ml-1 italic">
            — {projectVersions[currentVersionIndex].brief!.mood}
          </span>
        )}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* View all button */}
      <button
        onClick={() => setShowPopover((p) => !p)}
        className="text-[11px] font-medium text-zinc-600 hover:text-zinc-300 transition-colors"
      >
        View all →
      </button>

      {/* Popover */}
      {showPopover && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPopover(false)} />
          <div
            className="absolute bottom-9 right-3 z-50 w-72 rounded-lg border border-zinc-700/80 overflow-hidden"
            style={{ background: "#141416", boxShadow: "0 -8px 32px rgba(0,0,0,0.7)" }}
          >
            <div className="px-3 py-2 border-b border-zinc-800/60">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Version history</span>
            </div>
            <div className="overflow-y-auto max-h-52 py-1">
              {projectVersions.map((v, i) => {
                const recipe = RECIPES[(v.project.styleRecipe as StyleRecipe)] ?? RECIPES["cinematic-rain"];
                const isCurrent = i === currentVersionIndex;
                return (
                  <button
                    key={i}
                    onClick={() => { restoreVersion(i); setShowPopover(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      isCurrent ? "bg-zinc-800/60" : "hover:bg-zinc-800/40"
                    }`}
                  >
                    {/* Color swatch */}
                    <div
                      className="w-8 h-5 rounded flex-none"
                      style={{
                        background: `linear-gradient(90deg, ${recipe.palette.bg} 0%, ${recipe.palette.accent} 100%)`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-[12px] font-medium ${isCurrent ? "text-zinc-200" : "text-zinc-400"}`}>
                          v{i + 1}
                        </span>
                        {v.brief?.mood && (
                          <span className="text-[11px] text-zinc-500 truncate italic">{v.brief.mood}</span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-700 font-mono">{relativeTime(v.timestamp)}</div>
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] font-medium text-zinc-400 flex-none">current</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
