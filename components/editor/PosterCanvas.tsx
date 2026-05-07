"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { usePosterStore } from "@/store/posterStore";
import type { PosterLayer } from "@/types/poster";

// Each named export must be wrapped as { default: ... } so Next.js dynamic()
// can correctly detect the module shape without throwing
// "Cannot use 'in' operator to search for 'default' in <KonvaClass>".
const Stage = dynamic(
  () => import("react-konva").then((m) => ({ default: m.Stage })),
  { ssr: false }
);
const KonvaLayer = dynamic(
  () => import("react-konva").then((m) => ({ default: m.Layer })),
  { ssr: false }
);
const KonvaRect = dynamic(
  () => import("react-konva").then((m) => ({ default: m.Rect })),
  { ssr: false }
);
const KonvaText = dynamic(
  () => import("react-konva").then((m) => ({ default: m.Text })),
  { ssr: false }
);
const KonvaImage = dynamic(
  () => import("react-konva").then((m) => ({ default: m.Image })),
  { ssr: false }
);
const KonvaTransformer = dynamic(
  () => import("react-konva").then((m) => ({ default: m.Transformer })),
  { ssr: false }
);

const SCALE = 0.5;

export function PosterCanvas() {
  const { project, selectedLayerId, selectLayer, updateLayer, getSortedLayers } =
    usePosterStore();
  const stageRef = useRef<import("konva/lib/Stage").Stage | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { setReady(true); }, []);

  const handleExport = useCallback(() => {
    if (!stageRef.current || !project) return;
    const stage = stageRef.current;
    const scale = stage.scaleX();
    stage.scale({ x: 1, y: 1 });
    stage.size({ width: project.canvas.width, height: project.canvas.height });
    const uri = stage.toDataURL({ pixelRatio: 2 });
    stage.scale({ x: scale, y: scale });
    stage.size({ width: project.canvas.width * SCALE, height: project.canvas.height * SCALE });
    const link = document.createElement("a");
    link.download = `${project.title}.png`;
    link.href = uri;
    link.click();
  }, [project]);

  useEffect(() => {
    (window as Window & { __posterExport?: () => void }).__posterExport = handleExport;
  }, [handleExport]);

  if (!ready || !project) return null;

  const displayW = project.canvas.width * SCALE;
  const displayH = project.canvas.height * SCALE;
  const sortedLayers = getSortedLayers();

  return (
    <div
      className="relative shadow-2xl"
      style={{ width: displayW, height: displayH, background: "#111" }}
    >
      <Stage
        ref={stageRef}
        width={displayW}
        height={displayH}
        scaleX={SCALE}
        scaleY={SCALE}
        onClick={(e) => {
          if (e.target === e.target.getStage()) selectLayer(null);
        }}
      >
        <KonvaLayer>
          {/* Black canvas base */}
          <KonvaRect
            x={0} y={0}
            width={project.canvas.width}
            height={project.canvas.height}
            fill="#000000"
          />

          {sortedLayers
            .filter((l) => l.visible)
            .map((layer) => {
              // Safety guard: skip any malformed layer object
              if (!layer || typeof layer !== "object" || !layer.id || !layer.type) {
                console.warn("PosterCanvas: skipping invalid layer", layer);
                return null;
              }
              return (
                <PosterLayerNode
                  key={layer.id}
                  layer={layer}
                  selected={selectedLayerId === layer.id}
                  onSelect={() => !layer.locked && selectLayer(layer.id)}
                  onChange={(attrs) => updateLayer(layer.id, attrs)}
                />
              );
            })}
        </KonvaLayer>
      </Stage>

      <button
        onClick={handleExport}
        className="absolute bottom-3 right-3 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 text-xs px-3 py-1.5 rounded-lg backdrop-blur transition-colors"
      >
        Export PNG
      </button>
    </div>
  );
}

// Renamed from LayerNode → PosterLayerNode to avoid any confusion with Konva's Layer
function PosterLayerNode({
  layer,
  selected,
  onSelect,
  onChange,
}: {
  layer: PosterLayer;
  selected: boolean;
  onSelect: () => void;
  onChange: (attrs: Partial<PosterLayer>) => void;
}) {
  const shapeRef = useRef<
    | import("konva/lib/shapes/Text").Text
    | import("konva/lib/shapes/Image").Image
    | null
  >(null);
  const transformerRef =
    useRef<import("konva/lib/shapes/Transformer").Transformer | null>(null);

  useEffect(() => {
    if (selected && transformerRef.current && shapeRef.current) {
      transformerRef.current.nodes([shapeRef.current as never]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selected]);

  const commonProps = {
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    opacity: layer.opacity,
    draggable: !layer.locked,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (e: { target: { x: () => number; y: () => number } }) =>
      onChange({ x: e.target.x(), y: e.target.y() }),
    onTransformEnd: (e: {
      target: {
        x: () => number; y: () => number;
        scaleX: () => number; scaleY: () => number;
        rotation: () => number;
        width: () => number; height: () => number;
        setAttrs: (a: Record<string, number>) => void;
      };
    }) => {
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.setAttrs({ scaleX: 1, scaleY: 1 });
      onChange({
        x: node.x(), y: node.y(),
        width: Math.max(5, node.width() * scaleX),
        height: Math.max(5, node.height() * scaleY),
        rotation: node.rotation(),
      });
    },
  };

  const isImageType =
    layer.type === "backgroundImage" ||
    layer.type === "subjectImage" ||
    layer.type === "foregroundCutout" ||
    layer.type === "userImage";

  if (isImageType) {
    return (
      <KonvaImageNode
        layer={layer}
        selected={selected}
        commonProps={commonProps}
        shapeRef={shapeRef as React.MutableRefObject<import("konva/lib/shapes/Image").Image | null>}
        transformerRef={transformerRef}
      />
    );
  }

  // Text layer — guard against missing textData
  const td = layer.textData;
  if (!td) {
    console.warn("PosterCanvas: text layer missing textData", layer.id, layer.type);
    return null;
  }

  return (
    <>
      <KonvaText
        ref={shapeRef as React.MutableRefObject<import("konva/lib/shapes/Text").Text | null>}
        {...commonProps}
        width={layer.width}
        text={td.text ?? ""}
        fontSize={td.fontSize ?? 24}
        fontFamily={td.fontFamily ?? "Arial"}
        fontStyle={td.fontStyle ?? "normal"}
        fill={td.fill ?? "#ffffff"}
        align={td.align ?? "left"}
        letterSpacing={td.letterSpacing ?? 0}
        lineHeight={td.lineHeight ?? 1.2}
        wrap="word"
        onDblClick={() => {
          const newText = prompt("Edit text:", td.text);
          if (newText !== null) {
            usePosterStore.getState().updateTextData(layer.id, { text: newText });
          }
        }}
      />
      {selected && <KonvaTransformer ref={transformerRef} rotateEnabled keepRatio={false} />}
    </>
  );
}

function KonvaImageNode({
  layer,
  selected,
  commonProps,
  shapeRef,
  transformerRef,
}: {
  layer: PosterLayer;
  selected: boolean;
  commonProps: Record<string, unknown>;
  shapeRef: React.MutableRefObject<import("konva/lib/shapes/Image").Image | null>;
  transformerRef: React.MutableRefObject<import("konva/lib/shapes/Transformer").Transformer | null>;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imgError, setImgError] = useState(false);
  const src = layer.imageData?.src;

  useEffect(() => {
    if (!src) { setImage(null); setImgError(false); return; }
    setImgError(false);
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => setImage(img);
    img.onerror = () => {
      console.warn("PosterCanvas: image failed to load", src?.slice(0, 80));
      setImgError(true);
      setImage(null);
    };
  }, [src]);

  // Fallback rect when no src, load error, or still loading
  if (!src || imgError || !image) {
    return (
      <KonvaRect
        x={layer.x} y={layer.y}
        width={layer.width} height={layer.height}
        fill={layer.type === "backgroundImage" ? "#0a0a0a" : "#1a1a1a"}
        stroke={selected ? "#71717a" : "transparent"}
        strokeWidth={2}
        opacity={layer.opacity}
        draggable={!layer.locked}
        onClick={commonProps.onClick as () => void}
        onTap={commonProps.onTap as () => void}
      />
    );
  }

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        {...commonProps}
        image={image}
        width={layer.width}
        height={layer.height}
      />
      {selected && <KonvaTransformer ref={transformerRef} rotateEnabled keepRatio={false} />}
    </>
  );
}
