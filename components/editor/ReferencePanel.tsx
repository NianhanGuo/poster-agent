"use client";
import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { usePosterStore } from "@/store/posterStore";
import type { ReferenceConfig } from "@/types/poster";
import { extractPaletteFromUrl } from "@/lib/colorExtract";

type TargetKey = keyof ReferenceConfig["targets"];

const TARGETS: { key: TargetKey; label: string }[] = [
  { key: "mood",            label: "Overall mood" },
  { key: "color",           label: "Color palette" },
  { key: "backgroundStyle", label: "Background style" },
  { key: "typography",      label: "Typography" },
  { key: "layout",          label: "Composition / layout" },
  { key: "texture",         label: "Texture / material" },
  { key: "lighting",        label: "Lighting" },
];

export function ReferencePanel() {
  const {
    reference,
    setReference,
    setReferenceImage,
    setReferencePalette,
    getSortedLayers,
    updateTextData,
    project,
  } = usePosterStore();

  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Re-extract palette whenever the reference image URL changes.
  // This covers both the dropzone upload path AND "Use as reference"
  // from the asset library (which calls setReferenceImage directly).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!reference.imageUrl) {
      setExtracting(false);
      return;
    }
    setExtracting(true);
    extractPaletteFromUrl(reference.imageUrl)
      .then((palette) => {
        if (palette.length > 0) {
          setReferencePalette(palette, "");
        } else {
          setReferencePalette([], "Could not extract palette from reference image");
        }
      })
      .catch(() => {
        setReferencePalette([], "Could not extract palette from reference image");
      })
      .finally(() => setExtracting(false));
  }, [reference.imageUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setBusy(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        if (url) setReferenceImage(url);
        setBusy(false);
      };
      reader.onerror = () => setBusy(false);
      reader.readAsDataURL(file);
    },
    [setReferenceImage],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    disabled: busy,
  });

  function toggleTarget(key: TargetKey) {
    setReference({
      targets: { ...reference.targets, [key]: !reference.targets[key] },
    });
  }

  // Apply extracted palette colors to unlocked text layers.
  function applyPaletteToCanvas() {
    if (!project || reference.palette.length === 0) return;
    const { palette } = reference;

    const accentColor =
      palette.find((p) => p.role === "accent")?.hex ??
      palette.find((p) => p.role === "highlight")?.hex ??
      palette[1]?.hex ??
      "#ffffff";

    const bodyColor =
      palette.find((p) => p.role === "highlight")?.hex ??
      palette[2]?.hex ??
      "#aaaaaa";

    getSortedLayers()
      .filter((l) => l.type.endsWith("Text") && !l.locked && l.textData)
      .forEach((l) => {
        const isTitle = l.type === "titleText" || l.type === "userText";
        updateTextData(l.id, {
          fill: isTitle ? accentColor : bodyColor,
          fillGradient: undefined,
        });
      });
  }

  return (
    <div className="p-3 space-y-4">
      <div className="pt-1 font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-700">
        Reference Image
      </div>

      {/* Image preview / upload */}
      {reference.imageUrl ? (
        <div className="relative group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={reference.imageUrl}
            alt="reference"
            className="w-full aspect-square object-cover rounded-sm"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm flex items-center justify-center gap-2">
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <button
                className="font-mono text-[9px] tracking-wide uppercase text-zinc-200 px-2 py-1 transition-colors hover:bg-white/10 rounded-sm"
                style={{ border: "1px solid rgba(255,255,255,0.2)" }}
              >
                Replace
              </button>
            </div>
            <button
              onClick={() => setReferenceImage(null)}
              className="font-mono text-[9px] tracking-wide uppercase text-zinc-500 px-2 py-1 transition-colors hover:text-red-400 rounded-sm"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className="rounded-sm py-8 text-center cursor-pointer transition-colors"
          style={{
            border: `1px dashed ${isDragActive ? "rgba(161,161,170,0.5)" : "rgba(255,255,255,0.1)"}`,
            background: isDragActive ? "rgba(255,255,255,0.03)" : "transparent",
          }}
        >
          <input {...getInputProps()} />
          <div className="space-y-1">
            <div className="text-zinc-600 text-xl leading-none">+</div>
            <div className="font-mono text-[9px] text-zinc-600 tracking-wide">
              {isDragActive ? "drop image" : "upload reference image"}
            </div>
          </div>
        </div>
      )}

      {/* Palette swatches */}
      {reference.imageUrl && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] tracking-[0.15em] uppercase text-zinc-600">
              Extracted palette
            </span>
            {extracting && (
              <span className="font-mono text-[8px] text-zinc-700">extracting…</span>
            )}
          </div>

          {reference.paletteError ? (
            <p className="font-mono text-[8px] text-red-500/70">{reference.paletteError}</p>
          ) : reference.palette.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1">
                {reference.palette.map((c) => (
                  <div key={c.hex} className="group/swatch relative">
                    <div
                      className="w-6 h-6 rounded-sm cursor-pointer hover:scale-110 transition-transform"
                      style={{
                        background: c.hex,
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                      title={`${c.hex} (${c.role})`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {reference.palette.map((c) => (
                  <span
                    key={c.hex}
                    className="font-mono text-[7px] text-zinc-700"
                    title={c.role}
                  >
                    {c.hex}
                  </span>
                ))}
              </div>
              {/* Apply palette button */}
              {project && (
                <button
                  onClick={applyPaletteToCanvas}
                  className="w-full font-mono text-[9px] tracking-wide uppercase py-1.5 transition-colors"
                  style={{
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#71717a",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "#e4e4e7";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.25)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "#71717a";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)";
                  }}
                >
                  Apply palette to text layers
                </button>
              )}
            </>
          ) : !extracting ? (
            <p className="font-mono text-[8px] text-zinc-700">no palette extracted yet</p>
          ) : null}
        </div>
      )}

      {/* Strength slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] tracking-[0.15em] uppercase text-zinc-600">
            Strength
          </span>
          <span className="font-mono text-[9px] text-zinc-500">
            {reference.strength}
            {reference.strength >= 71
              ? " — strict"
              : reference.strength >= 31
              ? " — noticeable"
              : " — loose"}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={reference.strength}
          onChange={(e) => setReference({ strength: Number(e.target.value) })}
          className="w-full h-0.5 accent-zinc-400"
        />
      </div>

      {/* Target checkboxes */}
      <div className="space-y-1.5">
        <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-zinc-600">
          Apply to
        </div>
        <div className="space-y-1.5">
          {TARGETS.map(({ key, label }) => {
            const active = reference.targets[key];
            return (
              <button
                key={key}
                onClick={() => toggleTarget(key)}
                className="flex items-center gap-2 w-full group text-left"
              >
                <span
                  className="w-3 h-3 flex-none flex items-center justify-center text-[8px] transition-colors"
                  style={{
                    border: `1px solid ${active ? "rgba(161,161,170,0.6)" : "rgba(255,255,255,0.15)"}`,
                    background: active ? "rgba(255,255,255,0.08)" : "transparent",
                    color: active ? "#e4e4e7" : "transparent",
                  }}
                >
                  ✓
                </span>
                <span
                  className="font-mono text-[9px] transition-colors"
                  style={{ color: active ? "#a1a1aa" : "#52525b" }}
                >
                  {label}
                  {key === "color" && reference.palette.length > 0 && (
                    <span className="ml-1 text-zinc-600">({reference.palette.length} colors)</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom instruction */}
      <div className="space-y-1.5">
        <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-zinc-600">
          Instruction
        </div>
        <textarea
          value={reference.instruction}
          onChange={(e) => setReference({ instruction: e.target.value })}
          placeholder="e.g. Use only the color palette, ignore composition…"
          rows={3}
          className="w-full bg-transparent text-zinc-300 font-mono text-[9px] leading-relaxed outline-none p-2 placeholder:text-zinc-700 resize-none transition-colors rounded-sm"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        />
      </div>

      {!reference.imageUrl && (
        <p className="font-mono text-[8px] text-zinc-700 text-center pt-1">
          Reference metadata and palette are sent to AI even without an image
        </p>
      )}
    </div>
  );
}
