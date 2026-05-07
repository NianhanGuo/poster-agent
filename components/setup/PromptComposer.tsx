"use client";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { usePosterStore } from "@/store/posterStore";
import { RECIPE_LIST } from "@/lib/styleRecipes";
import { CANVAS_PRESETS } from "@/types/poster";
import type {
  PosterType,
  Language,
  StyleRecipe,
  CanvasSize,
  ImageSource,
  ImageStyle,
  PosterSetupConfig,
  PosterProject,
} from "@/types/poster";

type Setter = (p: Partial<PosterSetupConfig>) => void;

const IMAGE_STYLES: { value: ImageStyle; label: string }[] = [
  { value: "cinematic-photography", label: "Cinematic" },
  { value: "abstract",              label: "Abstract" },
  { value: "collage",               label: "Collage" },
  { value: "minimal-graphic",       label: "Minimal" },
  { value: "painterly",             label: "Painterly" },
  { value: "custom",                label: "Custom…" },
];

const CANVAS_OPTIONS: { value: CanvasSize; label: string; dim: string }[] = [
  { value: "a4",             label: "A4",      dim: "794 × 1123" },
  { value: "a3",             label: "A3",      dim: "1123 × 1587" },
  { value: "instagram-post", label: "Square",  dim: "1080 × 1080" },
  { value: "instagram-story",label: "Story",   dim: "1080 × 1920" },
  { value: "custom",         label: "Custom",  dim: "" },
];

export function PromptComposer() {
  const { setProject } = usePosterStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [cfg, setCfg] = useState<PosterSetupConfig>({
    posterType:   "film",
    canvasSize:   "a4",
    language:     "en",
    styleRecipe:  "cinematic-rain",
    imageSource:  "generate",
    imageStyle:   "cinematic-photography",
    prompt:       "",
    aiWriteCopy:  false,
  });

  const set: Setter = (p) => setCfg((c) => ({ ...c, ...p }));

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const layoutRes = await fetch("/api/generate/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup: cfg, lockedLayers: [] }),
      });
      if (!layoutRes.ok) throw new Error();
      const { layers, canvas, imagePrompt, demo: layoutDemo } = await layoutRes.json();

      let finalLayers = layers;

      if (cfg.imageSource === "generate") {
        const imgRes = await fetch("/api/generate/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: imagePrompt,
            styleRecipe: cfg.styleRecipe,
            imageStyle: cfg.imageStyle,
            customImagePrompt: cfg.customImagePrompt,
            width: canvas.width,
            height: canvas.height,
          }),
        });
        const { url } = await imgRes.json();
        if (url) {
          finalLayers = layers.map((l: { type: string; imageData?: Record<string, unknown> }) =>
            l.type === "backgroundImage"
              ? { ...l, imageData: { ...l.imageData, src: url } }
              : l,
          );
        }
      }

      const now = new Date().toISOString();
      const project: PosterProject = {
        id:            uuidv4(),
        userId:        "local",
        title:         cfg.userTitle || cfg.prompt || "Untitled",
        canvas,
        layers:        finalLayers,
        styleRecipe:   cfg.styleRecipe,
        posterType:    cfg.posterType,
        language:      cfg.language,
        promptHistory: [cfg.prompt],
        lockedLayers:  [],
        isDemo:        !!layoutDemo,
        createdAt:     now,
        updatedAt:     now,
      };
      setProject(project);
    } catch {
      setError("Generation failed. Check your API key or try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Wordmark */}
      <div className="px-8 pt-8">
        <span className="font-mono text-xs tracking-[0.2em] text-zinc-600 uppercase">
          poster agent
        </span>
      </div>

      {/* Main composer */}
      <div className="flex-1 flex items-start justify-center px-8 pt-16 pb-24">
        <div className="w-full max-w-xl space-y-10">

          {/* Type toggle */}
          <TypeToggle value={cfg.posterType} set={set} />

          {/* Prompt */}
          <div className="space-y-2">
            <label className="block font-mono text-[10px] tracking-[0.2em] text-zinc-600 uppercase">
              What are we making?
            </label>
            <textarea
              value={cfg.prompt}
              onChange={(e) => set({ prompt: e.target.value })}
              placeholder="Describe the concept, mood, or subject…"
              rows={3}
              className="w-full bg-transparent border-b border-zinc-800 focus:border-zinc-500 outline-none text-zinc-100 text-sm resize-none pb-2 placeholder:text-zinc-700 transition-colors"
            />
          </div>

          {/* Style recipes */}
          <div className="space-y-3">
            <label className="block font-mono text-[10px] tracking-[0.2em] text-zinc-600 uppercase">
              Style
            </label>
            <div className="flex flex-wrap gap-2">
              {RECIPE_LIST.map((r) => (
                <Chip
                  key={r.id}
                  active={cfg.styleRecipe === r.id}
                  onClick={() => set({ styleRecipe: r.id as StyleRecipe })}
                >
                  {r.name}
                </Chip>
              ))}
            </div>
          </div>

          {/* Image source */}
          <div className="space-y-3">
            <label className="block font-mono text-[10px] tracking-[0.2em] text-zinc-600 uppercase">
              Image
            </label>
            <div className="flex gap-2">
              {(["generate", "upload", "reference"] as ImageSource[]).map((s) => (
                <Chip key={s} active={cfg.imageSource === s} onClick={() => set({ imageSource: s })}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Chip>
              ))}
            </div>

            {cfg.imageSource === "generate" && (
              <div className="flex flex-wrap gap-2 pt-1">
                {IMAGE_STYLES.map((s) => (
                  <Chip
                    key={s.value}
                    active={cfg.imageStyle === s.value}
                    onClick={() => set({ imageStyle: s.value })}
                    small
                  >
                    {s.label}
                  </Chip>
                ))}
              </div>
            )}

            {cfg.imageSource === "generate" && cfg.imageStyle === "custom" && (
              <input
                type="text"
                value={cfg.customImagePrompt ?? ""}
                onChange={(e) => set({ customImagePrompt: e.target.value })}
                placeholder="Describe the image style…"
                className="w-full bg-transparent border-b border-zinc-800 focus:border-zinc-500 outline-none text-zinc-200 text-xs pb-1.5 placeholder:text-zinc-700 transition-colors"
              />
            )}
          </div>

          {/* Row: language + canvas */}
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="block font-mono text-[10px] tracking-[0.2em] text-zinc-600 uppercase">
                Language
              </label>
              <div className="flex gap-2">
                {([["en","EN"],["zh","中文"],["mixed","Bilingual"]] as [Language,string][]).map(([v, l]) => (
                  <Chip key={v} active={cfg.language === v} onClick={() => set({ language: v })} small>
                    {l}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block font-mono text-[10px] tracking-[0.2em] text-zinc-600 uppercase">
                Canvas
              </label>
              <div className="flex flex-wrap gap-2">
                {CANVAS_OPTIONS.map((o) => (
                  <Chip
                    key={o.value}
                    active={cfg.canvasSize === o.value}
                    onClick={() => set({ canvasSize: o.value })}
                    small
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          {/* Custom canvas */}
          {cfg.canvasSize === "custom" && (
            <div className="flex gap-6">
              <div>
                <label className="font-mono text-[10px] tracking-widest text-zinc-600">Width px</label>
                <input type="number" value={cfg.customWidth ?? 800}
                  onChange={(e) => set({ customWidth: Number(e.target.value) })}
                  className="block w-24 mt-1 bg-transparent border-b border-zinc-800 text-zinc-200 text-xs outline-none pb-1" />
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-widest text-zinc-600">Height px</label>
                <input type="number" value={cfg.customHeight ?? 1200}
                  onChange={(e) => set({ customHeight: Number(e.target.value) })}
                  className="block w-24 mt-1 bg-transparent border-b border-zinc-800 text-zinc-200 text-xs outline-none pb-1" />
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-zinc-900" />

          {/* Copy toggle + user text */}
          <div className="space-y-4">
            <button
              onClick={() => set({ aiWriteCopy: !cfg.aiWriteCopy })}
              className="flex items-center gap-3 group"
            >
              <span className={`w-4 h-4 border flex items-center justify-center text-[10px] transition-colors ${cfg.aiWriteCopy ? "border-zinc-400 text-zinc-200" : "border-zinc-700 text-transparent"}`}>
                ✓
              </span>
              <span className="font-mono text-[10px] tracking-[0.15em] text-zinc-500 uppercase group-hover:text-zinc-400 transition-colors">
                Let AI write poster copy
              </span>
            </button>

            {!cfg.aiWriteCopy && (
              <div className="space-y-3 pl-7">
                {[
                  { key: "userTitle",       ph: "Title" },
                  { key: "userSubtitle",    ph: "Subtitle / tagline" },
                  { key: "userDateLocation",ph: "Date · Venue" },
                  { key: "userCredits",     ph: "Credits" },
                ].map(({ key, ph }) => (
                  <input
                    key={key}
                    type="text"
                    value={(cfg as unknown as Record<string, string>)[key] ?? ""}
                    onChange={(e) => set({ [key]: e.target.value } as Partial<PosterSetupConfig>)}
                    placeholder={ph}
                    className="block w-full bg-transparent border-b border-zinc-900 focus:border-zinc-700 text-zinc-300 text-xs outline-none pb-1.5 placeholder:text-zinc-700 transition-colors"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="font-mono text-xs text-red-500/80">{error}</p>
          )}

          {/* Generate */}
          <div className="flex justify-end pt-2">
            <button
              onClick={generate}
              disabled={busy}
              className="flex items-center gap-3 text-sm font-medium text-zinc-100 hover:text-white disabled:opacity-30 transition-colors group"
            >
              {busy ? (
                <>
                  <span className="w-3 h-3 border border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
                  <span className="font-mono text-xs tracking-widest text-zinc-500">Generating…</span>
                </>
              ) : (
                <>
                  <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-zinc-500 group-hover:text-zinc-400 transition-colors">Generate poster</span>
                  <span className="text-zinc-400 group-hover:translate-x-0.5 transition-transform">→</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeToggle({ value, set }: { value: PosterType; set: Setter }) {
  return (
    <div className="flex gap-6">
      {(["film", "exhibition"] as PosterType[]).map((t) => (
        <button
          key={t}
          onClick={() => set({ posterType: t })}
          className={`font-mono text-xs tracking-[0.2em] uppercase transition-colors ${
            value === t ? "text-zinc-100 border-b border-zinc-400" : "text-zinc-600 hover:text-zinc-400"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function Chip({
  children, active, onClick, small,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`border px-3 transition-colors font-mono tracking-wide uppercase ${
        small ? "py-1 text-[10px]" : "py-1.5 text-[11px]"
      } ${
        active
          ? "border-zinc-400 text-zinc-100 bg-zinc-900"
          : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400"
      }`}
    >
      {children}
    </button>
  );
}
