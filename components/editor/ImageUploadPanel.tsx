"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { usePosterStore } from "@/store/posterStore";
import type { Layer, ImageInputMode } from "@/types/poster";

const MODES: { value: ImageInputMode; label: string; desc: string }[] = [
  { value: "background", label: "Background", desc: "Use as full background" },
  { value: "crop-to-fit", label: "Crop to Fit", desc: "Crop to canvas ratio" },
  {
    value: "extract-subject",
    label: "Extract Subject",
    desc: "Cut out main subject (transparent PNG)",
  },
  {
    value: "style-reference",
    label: "Style Reference",
    desc: "Use for style only, not displayed",
  },
  {
    value: "no-modify",
    label: "As-Is",
    desc: "Use image without any modification",
  },
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
      setStatus("Uploading…");

      try {
        // 1. Upload file
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const { url } = await uploadRes.json();

        if (mode === "style-reference") {
          setStatus("Saved as style reference (not added to canvas)");
          setIsUploading(false);
          return;
        }

        if (mode === "extract-subject") {
          setStatus("Extracting subject…");
          const extractFormData = new FormData();
          extractFormData.append("image", file);
          const extractRes = await fetch("/api/generate/subject", {
            method: "POST",
            body: extractFormData,
          });
          const { url: cutoutUrl, message } = await extractRes.json();

          const canvas = project.canvas;
          const newLayer: Layer = {
            id: crypto.randomUUID(),
            type: "foreground-cutout",
            label: "Subject Cutout",
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height,
            rotation: 0,
            opacity: 1,
            visible: true,
            locked: false,
            zIndex:
              Math.max(0, ...getSortedLayers().map((l) => l.zIndex)) + 1,
            imageData: { src: cutoutUrl, fit: "contain" },
          };
          addLayer(newLayer);
          setStatus(message ?? "Subject extracted");
        } else if (
          mode === "background" ||
          mode === "crop-to-fit" ||
          mode === "no-modify"
        ) {
          // Find existing background-image layer or create new one
          const bgLayer = getSortedLayers().find(
            (l) => l.type === "background-image"
          );
          const canvas = project.canvas;

          if (bgLayer && mode === "background") {
            updateLayer(bgLayer.id, {
              imageData: { src: url, fit: "fill" },
            });
            setStatus("Background updated");
          } else {
            const newLayer: Layer = {
              id: crypto.randomUUID(),
              type: mode === "background" ? "background-image" : "user-image",
              label:
                mode === "background" ? "Background Image" : "Uploaded Image",
              x: 0,
              y: 0,
              width: canvas.width,
              height: canvas.height,
              rotation: 0,
              opacity: 1,
              visible: true,
              locked: false,
              zIndex: mode === "background" ? 1 : 10,
              imageData: { src: url, fit: mode === "crop-to-fit" ? "cover" : "fill" },
            };
            addLayer(newLayer);
            setStatus("Image added to canvas");
          }
        }
      } catch (e) {
        console.error(e);
        setStatus("Upload failed. Please try again.");
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
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-300">Add Image</span>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 text-sm"
        >
          ×
        </button>
      </div>

      {/* Mode selector */}
      <div className="space-y-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${
              mode === m.value
                ? "bg-violet-600/20 text-violet-300 border border-violet-600/40"
                : "text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            <span className="font-medium">{m.label}</span>
            <span className="text-zinc-500 ml-1">— {m.desc}</span>
          </button>
        ))}
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-violet-500 bg-violet-500/10"
            : "border-zinc-600 hover:border-zinc-500"
        }`}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <div className="flex items-center justify-center gap-2 text-xs text-violet-400">
            <div className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full animate-spin" />
            {status}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            {isDragActive ? "Drop here" : "Drop image or click to browse"}
          </p>
        )}
      </div>

      {status && !isUploading && (
        <p className="text-xs text-zinc-400 text-center">{status}</p>
      )}
    </div>
  );
}
