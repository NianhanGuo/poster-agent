"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { usePosterStore } from "@/store/posterStore";
import type { PosterLayer, ImageInputMode } from "@/types/poster";

const MODES: { value: ImageInputMode; label: string; hint: string }[] = [
  { value: "new-layer",   label: "Add Layer",       hint: "New independent image layer" },
  { value: "background",  label: "Set Background",  hint: "Replace or create background" },
  { value: "foreground",  label: "Foreground",      hint: "Place above all other layers" },
  { value: "texture",     label: "Texture",         hint: "Semi-transparent overlay above background" },
  { value: "reference",   label: "Reference",       hint: "Use for style reference only (no layer added)" },
];

interface Props { onClose: () => void }

export function ImageUploadPanel({ onClose }: Props) {
  const { project, addLayer, updateLayer, getSortedLayers, setReferenceImage } = usePosterStore();
  const [mode, setMode] = useState<ImageInputMode>("new-layer");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file || !project) return;

      setBusy(true);
      setStatus("");

      const reader = new FileReader();

      reader.onload = (e) => {
        const dataUrl = e.target?.result as string | undefined;
        if (!dataUrl) {
          setStatus("Could not read file.");
          setBusy(false);
          return;
        }

        if (mode === "reference") {
          setReferenceImage(dataUrl);
          setStatus("set as reference");
          setBusy(false);
          return;
        }

        const canvas = project.canvas;
        const layers = getSortedLayers();
        const maxZ = Math.max(0, ...layers.map((l) => l.zIndex));
        const baseName = file.name.replace(/\.[^/.]+$/, "");

        if (mode === "background") {
          const bgLayer = layers.find((l) => l.type === "backgroundImage");
          if (bgLayer) {
            updateLayer(bgLayer.id, { imageData: { src: dataUrl, fit: "fill" } });
            setStatus("background updated");
          } else {
            const newLayer: PosterLayer = {
              id: crypto.randomUUID(),
              type: "backgroundImage",
              label: "Background",
              x: 0, y: 0,
              width: canvas.width, height: canvas.height,
              rotation: 0, opacity: 1,
              visible: true, locked: false,
              zIndex: 1,
              imageData: { src: dataUrl, fit: "fill" },
            };
            addLayer(newLayer);
            setStatus("background added");
          }
          setBusy(false);
          return;
        }

        if (mode === "texture") {
          const bgZ = layers.find((l) => l.type === "backgroundImage")?.zIndex ?? 1;
          const newLayer: PosterLayer = {
            id: crypto.randomUUID(),
            type: "userImage",
            label: baseName || "Texture",
            x: 0, y: 0,
            width: canvas.width, height: canvas.height,
            rotation: 0, opacity: 0.35,
            visible: true, locked: false,
            zIndex: bgZ + 1,
            imageData: { src: dataUrl, fit: "fill" },
          };
          addLayer(newLayer);
          setStatus("texture added");
          setBusy(false);
          return;
        }

        if (mode === "foreground") {
          const userImgCount = layers.filter((l) => l.type === "userImage").length;
          const newLayer: PosterLayer = {
            id: crypto.randomUUID(),
            type: "userImage",
            label: baseName || `image ${userImgCount + 1}`,
            x: Math.round(canvas.width * 0.1),
            y: Math.round(canvas.height * 0.1),
            width: Math.round(canvas.width * 0.8),
            height: Math.round(canvas.height * 0.8),
            rotation: 0, opacity: 1,
            visible: true, locked: false,
            zIndex: maxZ + 1,
            imageData: { src: dataUrl, fit: "contain" },
          };
          addLayer(newLayer);
          setStatus("foreground added");
          setBusy(false);
          return;
        }

        // "new-layer" default — auto-assign zIndex via store (pass 0)
        const userImgCount = layers.filter((l) => l.type === "userImage").length;
        const newLayer: PosterLayer = {
          id: crypto.randomUUID(),
          type: "userImage",
          label: baseName || `image ${userImgCount + 1}`,
          x: Math.round(canvas.width * 0.05),
          y: Math.round(canvas.height * 0.05),
          width: Math.round(canvas.width * 0.9),
          height: Math.round(canvas.height * 0.9),
          rotation: 0, opacity: 1,
          visible: true, locked: false,
          zIndex: 0,
          imageData: { src: dataUrl, fit: "contain" },
        };
        addLayer(newLayer);
        setStatus("layer added");
        setBusy(false);
      };

      reader.onerror = () => {
        setStatus("Failed to read file.");
        setBusy(false);
      };

      reader.readAsDataURL(file);
    },
    [mode, project, addLayer, updateLayer, getSortedLayers, setReferenceImage],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    disabled: busy,
  });

  const activeMode = MODES.find((m) => m.value === mode);

  return (
    <div className="border border-zinc-800 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-zinc-600">Image</span>
        <button onClick={onClose} className="font-mono text-[10px] text-zinc-700 hover:text-zinc-400">×</button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => { setMode(m.value); setStatus(""); }}
            title={m.hint}
            className={`font-mono text-[9px] tracking-wide uppercase px-2 py-1 border transition-colors ${
              mode === m.value
                ? "border-zinc-500 text-zinc-200"
                : "border-zinc-800 text-zinc-600 hover:border-zinc-600"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {activeMode && (
        <p className="font-mono text-[9px] text-zinc-700">{activeMode.hint}</p>
      )}

      <div
        {...getRootProps()}
        className={`border border-dashed py-5 text-center transition-colors ${
          busy
            ? "border-zinc-800 cursor-wait"
            : isDragActive
              ? "border-zinc-500 bg-zinc-900 cursor-copy"
              : "border-zinc-800 hover:border-zinc-700 cursor-pointer"
        }`}
      >
        <input {...getInputProps()} />
        {busy ? (
          <div className="flex items-center justify-center gap-2">
            <span className="w-2.5 h-2.5 border border-zinc-600 border-t-zinc-300 rounded-full animate-spin inline-block" />
            <span className="font-mono text-[10px] text-zinc-500">reading…</span>
          </div>
        ) : (
          <span className="font-mono text-[10px] text-zinc-700">
            {isDragActive ? "drop" : "drop or click"}
          </span>
        )}
      </div>

      {status && !busy && (
        <p className="font-mono text-[10px] text-zinc-600 text-center">{status}</p>
      )}
    </div>
  );
}
