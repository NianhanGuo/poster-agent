"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { usePosterStore } from "@/store/posterStore";
import type { PosterLayer, ImageInputMode } from "@/types/poster";

const MODES: { value: ImageInputMode; label: string }[] = [
  { value: "background",       label: "Background" },
  { value: "crop-to-fit",      label: "Crop to fit" },
  { value: "extract-subject",  label: "Extract subject" },
  { value: "no-modify",        label: "As-is" },
];

interface Props {
  onClose: () => void;
}

export function ImageUploadPanel({ onClose }: Props) {
  const { project, addLayer, updateLayer, getSortedLayers } = usePosterStore();
  const [mode, setMode] = useState<ImageInputMode>("background");
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState("");

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file || !project) return;

      setIsUploading(true);
      setStatus("uploading…");

      try {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        const { url } = await uploadRes.json();

        if (mode === "extract-subject") {
          setStatus("extracting subject…");
          const ef = new FormData();
          ef.append("image", file);
          const extractRes = await fetch("/api/generate/subject", { method: "POST", body: ef });
          const { url: cutoutUrl, message } = await extractRes.json();

          const canvas = project.canvas;
          const newLayer: PosterLayer = {
            id: crypto.randomUUID(),
            type: "foregroundCutout",
            label: "Subject Cutout",
            x: 0, y: 0,
            width: canvas.width, height: canvas.height,
            rotation: 0, opacity: 1, visible: true, locked: false,
            zIndex: Math.max(0, ...getSortedLayers().map((l) => l.zIndex)) + 1,
            imageData: { src: cutoutUrl, fit: "contain" },
          };
          addLayer(newLayer);
          setStatus(message ?? "Subject extracted");
        } else {
          const bgLayer = getSortedLayers().find((l) => l.type === "backgroundImage");
          const canvas = project.canvas;

          if (bgLayer && mode === "background") {
            updateLayer(bgLayer.id, { imageData: { src: url, fit: "fill" } });
            setStatus("background updated");
          } else {
            const newLayer: PosterLayer = {
              id: crypto.randomUUID(),
              type: mode === "background" ? "backgroundImage" : "userImage",
              label: mode === "background" ? "Background" : "Image",
              x: 0, y: 0,
              width: canvas.width, height: canvas.height,
              rotation: 0, opacity: 1, visible: true, locked: false,
              zIndex: mode === "background" ? 1 : 10,
              imageData: { src: url, fit: mode === "crop-to-fit" ? "cover" : "fill" },
            };
            addLayer(newLayer);
            setStatus("added");
          }
        }
      } catch {
        setStatus("upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [mode, project, addLayer, updateLayer, getSortedLayers]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
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
            onClick={() => setMode(m.value)}
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

      <div
        {...getRootProps()}
        className={`border border-dashed py-5 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-zinc-500 bg-zinc-900" : "border-zinc-800 hover:border-zinc-700"
        }`}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <div className="flex items-center justify-center gap-2">
            <span className="w-2.5 h-2.5 border border-zinc-600 border-t-zinc-300 rounded-full animate-spin inline-block" />
            <span className="font-mono text-[10px] text-zinc-500">{status}</span>
          </div>
        ) : (
          <span className="font-mono text-[10px] text-zinc-700">
            {isDragActive ? "drop" : "drop or click"}
          </span>
        )}
      </div>

      {status && !isUploading && (
        <p className="font-mono text-[10px] text-zinc-600 text-center">{status}</p>
      )}
    </div>
  );
}
