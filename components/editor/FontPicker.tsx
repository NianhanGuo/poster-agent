"use client";
import { useState, useEffect, useRef } from "react";
import { FONT_LIST, loadGoogleFont, searchFonts } from "@/lib/fonts";
import type { FontCategory } from "@/lib/fonts";

interface Props {
  value: string;
  onChange: (family: string, weights: number[]) => void;
}

const CATEGORIES: { value: FontCategory | "all"; label: string }[] = [
  { value: "all",     label: "All" },
  { value: "sans",    label: "Sans" },
  { value: "serif",   label: "Serif" },
  { value: "display", label: "Display" },
  { value: "script",  label: "Script" },
  { value: "mono",    label: "Mono" },
];

export function FontPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<FontCategory | "all">("all");
  const previewed = useRef<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  const results = searchFonts(query, cat === "all" ? undefined : cat);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Load preview fonts when they become visible
  useEffect(() => {
    const toLoad = results.slice(0, 20).filter((f) => !previewed.current.has(f.family));
    if (toLoad.length === 0) return;
    toLoad.forEach((f) => {
      loadGoogleFont(f.family, [400]);
      previewed.current.add(f.family);
    });
  }, [results]);

  function select(family: string) {
    const def = FONT_LIST.find((f) => f.family === family);
    const weights = def?.weights ?? [400];
    loadGoogleFont(family, weights);
    onChange(family, weights);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between bg-transparent border-b border-zinc-800 hover:border-zinc-600 pb-0.5 transition-colors"
      >
        <span
          className="text-zinc-300 text-[11px] truncate"
          style={{ fontFamily: value }}
        >
          {value}
        </span>
        <span className="text-zinc-700 text-[10px] ml-1">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-zinc-950 border border-zinc-800 shadow-2xl"
          style={{ width: "260px" }}
        >
          {/* Search */}
          <div className="p-2 border-b border-zinc-900">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search fonts…"
              className="w-full bg-transparent font-mono text-[10px] text-zinc-300 placeholder:text-zinc-700 outline-none"
            />
          </div>

          {/* Category tabs */}
          <div className="flex border-b border-zinc-900">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCat(c.value)}
                className={`flex-1 font-mono text-[9px] tracking-wide uppercase py-1.5 transition-colors ${
                  cat === c.value ? "text-zinc-200 border-b border-zinc-400" : "text-zinc-700 hover:text-zinc-500"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Font list */}
          <div className="overflow-y-auto max-h-52">
            {results.length === 0 ? (
              <div className="font-mono text-[10px] text-zinc-700 text-center py-4">no results</div>
            ) : (
              results.map((f) => (
                <button
                  key={f.family}
                  onClick={() => select(f.family)}
                  className={`w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-900 transition-colors ${
                    f.family === value ? "bg-zinc-900" : ""
                  }`}
                >
                  <span
                    className="text-[13px] text-zinc-200 truncate"
                    style={{ fontFamily: f.family }}
                  >
                    {f.family}
                  </span>
                  <span className="font-mono text-[9px] text-zinc-700 flex-none ml-2">
                    {f.category}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
