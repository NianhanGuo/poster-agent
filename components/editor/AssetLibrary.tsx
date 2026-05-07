"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { usePosterStore } from "@/store/posterStore";
import type { AssetItem, PosterLayer } from "@/types/poster";

type UsageAction = "background" | "layer" | "reference";

const ACTIONS: { value: UsageAction; label: string }[] = [
  { value: "background", label: "Background" },
  { value: "layer",      label: "Add layer" },
  { value: "reference",  label: "As reference" },
];

export function AssetLibrary() {
  const {
    assets,
    addAsset,
    removeAsset,
    addLayer,
    updateLayer,
    getSortedLayers,
    setReferenceImage,
    project,
  } = usePosterStore();
  const [busy, setBusy] = useState(false);

  const onDrop = useCallback(
    (files: File[]) => {
      files.forEach((file) => {
        setBusy(true);
        const reader = new FileReader();
        reader.onload = (e) => {
          const url = e.target?.result as string;
          if (!url) { setBusy(false); return; }
          const asset: AssetItem = {
            id: crypto.randomUUID(),
            userId: "local",
            imageUrl: url,
            fileName: file.name,
            createdAt: new Date().toISOString(),
          };
          addAsset(asset);
          setBusy(false);
        };
        reader.onerror = () => setBusy(false);
        reader.readAsDataURL(file);
      });
    },
    [addAsset],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    disabled: busy,
  });

  function applyAsset(asset: AssetItem, action: UsageAction) {
    if (!project) return;

    if (action === "reference") {
      setReferenceImage(asset.imageUrl);
      return;
    }

    const canvas = project.canvas;
    const layers = getSortedLayers();
    const bgLayer = layers.find((l) => l.type === "backgroundImage");

    if (action === "background") {
      if (bgLayer) {
        updateLayer(bgLayer.id, { imageData: { src: asset.imageUrl, fit: "fill" } });
      } else {
        const newLayer: PosterLayer = {
          id: crypto.randomUUID(),
          type: "backgroundImage",
          label: "Background",
          x: 0, y: 0,
          width: canvas.width,
          height: canvas.height,
          rotation: 0, opacity: 1,
          visible: true, locked: false, zIndex: 1,
          imageData: { src: asset.imageUrl, fit: "fill" },
        };
        addLayer(newLayer);
      }
    } else {
      const maxZ = Math.max(0, ...layers.map((l) => l.zIndex));
      const name = asset.fileName.replace(/\.[^/.]+$/, "");
      const newLayer: PosterLayer = {
        id: crypto.randomUUID(),
        type: "userImage",
        label: name,
        x: Math.round(canvas.width * 0.1),
        y: Math.round(canvas.height * 0.1),
        width: Math.round(canvas.width * 0.8),
        height: Math.round(canvas.height * 0.5),
        rotation: 0, opacity: 1,
        visible: true, locked: false,
        zIndex: maxZ + 1,
        imageData: { src: asset.imageUrl, fit: "contain" },
      };
      addLayer(newLayer);
    }
  }

  return (
    <div className="p-3 space-y-3">
      <div className="pt-1 font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-700">
        Assets
      </div>

      {/* Upload drop zone */}
      <div
        {...getRootProps()}
        className="rounded-sm py-3 text-center cursor-pointer transition-colors"
        style={{
          border: `1px dashed ${isDragActive ? "rgba(161,161,170,0.5)" : "rgba(255,255,255,0.1)"}`,
          background: isDragActive ? "rgba(255,255,255,0.03)" : "transparent",
        }}
      >
        <input {...getInputProps()} />
        <span className="font-mono text-[9px] text-zinc-600">
          {busy ? "uploading…" : isDragActive ? "drop files" : "+ upload images"}
        </span>
      </div>

      {/* Grid */}
      {assets.length === 0 ? (
        <div className="font-mono text-[9px] text-zinc-700 text-center py-6">
          no assets yet
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {assets.map((asset) => (
            <AssetThumbnail
              key={asset.id}
              asset={asset}
              onUse={(action) => applyAsset(asset, action)}
              onDelete={() => removeAsset(asset.id)}
            />
          ))}
        </div>
      )}

      <p className="font-mono text-[8px] text-zinc-700 text-center">
        Temporary — sign in to save permanently
      </p>
    </div>
  );
}

function AssetThumbnail({
  asset,
  onUse,
  onDelete,
}: {
  asset: AssetItem;
  onUse: (action: UsageAction) => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative group aspect-square">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.imageUrl}
        alt={asset.fileName}
        className="w-full h-full object-cover rounded-sm"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      />
      <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm flex flex-col items-center justify-center gap-0.5 p-1">
        {ACTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onUse(value)}
            className="w-full font-mono text-[8px] tracking-wide text-zinc-300 py-0.5 hover:bg-white/10 transition-colors text-center rounded-sm"
            style={{ border: "1px solid rgba(255,255,255,0.12)" }}
          >
            {label}
          </button>
        ))}
        <button
          onClick={onDelete}
          className="w-full font-mono text-[8px] text-zinc-600 hover:text-red-400 transition-colors text-center mt-0.5 py-0.5"
        >
          delete
        </button>
      </div>
    </div>
  );
}
