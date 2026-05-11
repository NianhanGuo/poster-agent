"use client";
import { useState, useEffect, useRef } from "react";
import { FONT_LIST, CURATED_FONT_GROUPS, loadGoogleFont, searchFonts } from "@/lib/fonts";

interface Props {
  value: string;
  onChange: (family: string, weights: number[]) => void;
}

export function FontPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const previewed = useRef<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  const isSearching = query.trim().length > 0;
  const searchResults = isSearching ? searchFonts(query) : [];

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Load preview fonts — curated groups on open, search results while searching
  useEffect(() => {
    const toPreview = isSearching
      ? searchResults.slice(0, 20).map((f) => f.family)
      : Object.values(CURATED_FONT_GROUPS).flat();
    const toLoad = toPreview.filter((fam) => !previewed.current.has(fam));
    toLoad.forEach((fam) => {
      loadGoogleFont(fam, [400]);
      previewed.current.add(fam);
    });
  }, [isSearching, searchResults]);

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
        <span className="text-zinc-300 text-[11px] truncate" style={{ fontFamily: value }}>
          {value}
        </span>
        <span className="text-zinc-700 text-[10px] ml-1">▾</span>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-50 bg-zinc-950 border border-zinc-800 shadow-2xl"
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

          <div className="overflow-y-auto max-h-64">
            {isSearching ? (
              // Flat search results
              searchResults.length === 0 ? (
                <div className="font-mono text-[10px] text-zinc-700 text-center py-4">no results</div>
              ) : (
                searchResults.map((f) => (
                  <FontRow key={f.family} family={f.family} category={f.category} active={f.family === value} onSelect={select} />
                ))
              )
            ) : (
              // Grouped curated list
              Object.entries(CURATED_FONT_GROUPS).map(([group, families]) => (
                <div key={group}>
                  <div
                    className="px-3 pt-2.5 pb-1 font-mono text-[8px] tracking-[0.12em] uppercase text-zinc-600"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    {group}
                  </div>
                  {families.map((fam) => (
                    <FontRow key={fam} family={fam} active={fam === value} onSelect={select} />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FontRow({
  family,
  category,
  active,
  onSelect,
}: {
  family: string;
  category?: string;
  active: boolean;
  onSelect: (f: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(family)}
      className={`w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-900 transition-colors ${active ? "bg-zinc-900" : ""}`}
    >
      <span className="text-[13px] text-zinc-200 truncate" style={{ fontFamily: family }}>
        {family}
      </span>
      {category && (
        <span className="font-mono text-[9px] text-zinc-700 flex-none ml-2">{category}</span>
      )}
    </button>
  );
}
