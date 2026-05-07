"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { usePosterStore } from "@/store/posterStore";
import type { PosterLayer, ImageInputMode } from "@/types/poster";

const MODES: { value: ImageInputMode; label: string; disabled?: boolean }[] = [
  { value: "background",      label: "Background" },
  { value: "crop-to-fit",     label: "Crop to fit" },
  { value: "no-modify",       label: "As-is" },
  { value: "extract-subject", label: "Extract subject", disabled: true },
];

interface Props { onClose: () => void }

export function ImageUploadPanel({ onClose }: Props) {
  const { project, addLayer, updateLayer, getSortedLayers } = usePosterStore();
  const [mode, setMode] = useState<ImageInputMode>("background");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file || !project) return;

      if (mode === "extract-subject") {
        setStatus("Subject extraction requires REMOVE_BG_API_KEY on the server.");
        return;
      }

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

        const canvas = project.canvas;
        const fit = mode === "crop-to-fit" ? "cover" : "fill";
        const bgLayer = getSortedLayers().find((l) => l.type === "backgroundImage");

        if (bgLayer && (mode === "background" || mode === "crop-to-fit")) {
          // Replace existing background layer src in-place
          updateLayer(bgLayer.id, { imageData: { src: dataUrl, fit } });
          setStatus("background updated");
        } else {
          const isBackground = mode === "background";
          const newLayer: PosterLayer = {
            id: crypto.randomUUID(),
            type: isBackground ? "backgroundImage" : "userImage",
            label: isBackground ? "Background" : "Image",
            x: 0, y: 0,
            width: canvas.width,
            height: canvas.height,
            rotation: 0, opacity: 1,
            visible: true, locked: false,
            zIndex: isBackground ? 1 : Math.max(0, ...getSortedLayers().map((l) => l.zIndex)) + 1,
            imageData: { src: dataUrl, fit },
          };
          addLayer(newLayer);
          setStatus("added");
        }

        setBusy(false);
      };

      reader.onerror = () => {
        setStatus("Failed to read file.");
        setBusy(false);
      };

      reader.readAsDataURL(file);
    },
    [mode, project, addLayer, updateLayer, getSortedLayers],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    disabled: busy,
  });

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
            onClick={() => { if (!m.disabled) { setMode(m.value); setStatus(""); } }}
            disabled={m.disabled}
            title={m.disabled ? "Requires server API key" : undefined}
            className={`font-mono text-[9px] tracking-wide uppercase px-2 py-1 border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              mode === m.value && !m.disabled
                ? "border-zinc-500 text-zinc-200"
                : "border-zinc-800 text-zinc-600 hover:border-zinc-600"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

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
