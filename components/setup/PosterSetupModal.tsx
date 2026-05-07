"use client";
import { useState } from "react";
import type {
  PosterType,
  CanvasSize,
  Language,
  StylePreset,
  PosterSetupConfig,
} from "@/types/poster";

interface Props {
  onClose: () => void;
  onCreate: (projectId: string) => void;
}

const POSTER_TYPES: { value: PosterType; label: string; icon: string }[] = [
  { value: "film", label: "Film Poster", icon: "🎬" },
  { value: "exhibition", label: "Exhibition Poster", icon: "🖼" },
];

const CANVAS_SIZES_LIST: {
  value: CanvasSize;
  label: string;
  dims: string;
}[] = [
  { value: "instagram-post", label: "Instagram Post", dims: "1080×1080" },
  { value: "instagram-story", label: "Instagram Story", dims: "1080×1920" },
  { value: "square", label: "Square", dims: "800×800" },
  { value: "a4", label: "A4", dims: "794×1123" },
  { value: "a3", label: "A3", dims: "1123×1587" },
  { value: "custom", label: "Custom", dims: "custom" },
];

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "english", label: "English" },
  { value: "chinese", label: "Chinese" },
  { value: "bilingual", label: "Bilingual" },
];

const STYLE_PRESETS: {
  value: StylePreset;
  label: string;
  desc: string;
}[] = [
  { value: "cinematic", label: "Cinematic", desc: "Dark, moody, high contrast" },
  {
    value: "gallery-minimal",
    label: "Gallery Minimal",
    desc: "White space, refined typography",
  },
  { value: "brutalist", label: "Brutalist", desc: "Raw, unconventional, bold" },
  {
    value: "editorial",
    label: "Editorial",
    desc: "Magazine-like, strong hierarchy",
  },
  { value: "surreal", label: "Surreal", desc: "Dreamy, unexpected compositions" },
  {
    value: "experimental",
    label: "Experimental",
    desc: "Convention-breaking layouts",
  },
];

export function PosterSetupModal({ onClose, onCreate }: Props) {
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const [config, setConfig] = useState<PosterSetupConfig>({
    posterType: "film",
    canvasSize: "a4",
    language: "english",
    stylePreset: "cinematic",
    prompt: "",
    aiWriteCopy: false,
    userTitle: "",
    userSubtitle: "",
    userDateLocation: "",
    userCredits: "",
  });

  function update(partial: Partial<PosterSetupConfig>) {
    setConfig((c) => ({ ...c, ...partial }));
  }

  async function handleGenerate() {
    setIsGenerating(true);
    setError("");
    try {
      // 1. Generate layout
      const layoutRes = await fetch("/api/generate/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup: config, lockedLayers: [] }),
      });

      if (!layoutRes.ok) throw new Error("Layout generation failed");
      const { layers, canvas, imagePrompt } = await layoutRes.json();

      // 2. Generate image (non-blocking, placeholder if unavailable)
      const imgRes = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imagePrompt,
          style: config.stylePreset,
          width: canvas.width,
          height: canvas.height,
        }),
      });
      const imgData = await imgRes.json();

      // Inject image URL into background layer if available
      const finalLayers = layers.map(
        (l: { type: string; imageData?: Record<string, unknown> }) => {
          if (l.type === "background-image" && imgData.url) {
            return { ...l, imageData: { ...l.imageData, src: imgData.url } };
          }
          return l;
        }
      );

      // 3. Create project
      const projectRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: config.userTitle || config.prompt || "Untitled Poster",
          canvas,
          layers: finalLayers,
          stylePreset: config.stylePreset,
          posterType: config.posterType,
          language: config.language,
          promptHistory: [config.prompt],
          lockedLayers: [],
        }),
      });

      const { project } = await projectRes.json();
      onCreate(project.id);
    } catch (e) {
      console.error(e);
      setError("Generation failed. Please check your API keys and try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-white">New Poster</h2>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1 w-10 rounded-full transition-colors ${s <= step ? "bg-violet-500" : "bg-zinc-700"}`}
                />
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {step === 1 && (
            <Step1
              config={config}
              update={update}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <Step2
              config={config}
              update={update}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <Step3
              config={config}
              update={update}
              onBack={() => setStep(2)}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Step1({
  config,
  update,
  onNext,
}: {
  config: PosterSetupConfig;
  update: (p: Partial<PosterSetupConfig>) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Poster Type</h3>
        <div className="grid grid-cols-2 gap-3">
          {POSTER_TYPES.map((pt) => (
            <button
              key={pt.value}
              onClick={() => update({ posterType: pt.value })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                config.posterType === pt.value
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-zinc-700 hover:border-zinc-600"
              }`}
            >
              <div className="text-2xl mb-1">{pt.icon}</div>
              <div className="font-medium text-white text-sm">{pt.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Canvas Size</h3>
        <div className="grid grid-cols-3 gap-2">
          {CANVAS_SIZES_LIST.map((cs) => (
            <button
              key={cs.value}
              onClick={() => update({ canvasSize: cs.value })}
              className={`p-3 rounded-lg border text-left transition-all ${
                config.canvasSize === cs.value
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-zinc-700 hover:border-zinc-600"
              }`}
            >
              <div className="font-medium text-white text-xs">{cs.label}</div>
              <div className="text-zinc-500 text-xs mt-0.5">{cs.dims}</div>
            </button>
          ))}
        </div>
        {config.canvasSize === "custom" && (
          <div className="flex gap-3 mt-3">
            <div className="flex-1">
              <label className="text-xs text-zinc-500">Width (px)</label>
              <input
                type="number"
                value={config.customWidth ?? 800}
                onChange={(e) =>
                  update({ customWidth: Number(e.target.value) })
                }
                className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-zinc-500">Height (px)</label>
              <input
                type="number"
                value={config.customHeight ?? 600}
                onChange={(e) =>
                  update({ customHeight: Number(e.target.value) })
                }
                className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onNext}
        className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-3 rounded-lg transition-colors"
      >
        Next →
      </button>
    </div>
  );
}

function Step2({
  config,
  update,
  onBack,
  onNext,
}: {
  config: PosterSetupConfig;
  update: (p: Partial<PosterSetupConfig>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Style</h3>
        <div className="grid grid-cols-2 gap-2">
          {STYLE_PRESETS.map((sp) => (
            <button
              key={sp.value}
              onClick={() => update({ stylePreset: sp.value })}
              className={`p-3 rounded-lg border text-left transition-all ${
                config.stylePreset === sp.value
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-zinc-700 hover:border-zinc-600"
              }`}
            >
              <div className="font-medium text-white text-sm">{sp.label}</div>
              <div className="text-zinc-500 text-xs mt-0.5">{sp.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Language</h3>
        <div className="flex gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              onClick={() => update({ language: lang.value })}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                config.language === lang.value
                  ? "border-violet-500 bg-violet-500/10 text-violet-300"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 border border-zinc-700 text-zinc-300 hover:border-zinc-600 font-medium py-3 rounded-lg transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-medium py-3 rounded-lg transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function Step3({
  config,
  update,
  onBack,
  onGenerate,
  isGenerating,
  error,
}: {
  config: PosterSetupConfig;
  update: (p: Partial<PosterSetupConfig>) => void;
  onBack: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
  error: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm font-medium text-zinc-300">
          Describe your poster
        </label>
        <textarea
          value={config.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          placeholder="e.g. A noir thriller set in 1940s Shanghai, rain-soaked streets..."
          className="w-full mt-2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm resize-none h-24 focus:outline-none focus:border-violet-500 placeholder:text-zinc-600"
        />
      </div>

      {/* AI Write Copy toggle */}
      <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-xl">
        <div>
          <div className="text-sm font-medium text-white">AI Write Copy</div>
          <div className="text-xs text-zinc-500 mt-0.5">
            Let AI generate title, tagline, and credits text
          </div>
        </div>
        <button
          onClick={() => update({ aiWriteCopy: !config.aiWriteCopy })}
          className={`relative w-11 h-6 rounded-full transition-colors ${config.aiWriteCopy ? "bg-violet-600" : "bg-zinc-600"}`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${config.aiWriteCopy ? "translate-x-6" : "translate-x-1"}`}
          />
        </button>
      </div>

      {/* User-provided text */}
      {!config.aiWriteCopy && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">
            Provide your own text (leave blank to omit)
          </p>
          {[
            {
              key: "userTitle",
              label: "Title",
              placeholder: "ELYSIUM",
            },
            {
              key: "userSubtitle",
              label: "Subtitle / Tagline",
              placeholder: "There will be no mercy",
            },
            {
              key: "userDateLocation",
              label: "Date / Location",
              placeholder: "March 14 — April 30, 2025 · Shanghai",
            },
            {
              key: "userCredits",
              label: "Credits / Body",
              placeholder: "Directed by...",
            },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-zinc-400">{label}</label>
              <input
                type="text"
                value={(config as unknown as Record<string, string>)[key] ?? ""}
                onChange={(e) =>
                  update({ [key]: e.target.value } as Partial<PosterSetupConfig>)
                }
                placeholder={placeholder}
                className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 placeholder:text-zinc-600"
              />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={isGenerating}
          className="flex-1 border border-zinc-700 text-zinc-300 hover:border-zinc-600 font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
        >
          ← Back
        </button>
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            "Generate Poster ✨"
          )}
        </button>
      </div>
    </div>
  );
}
