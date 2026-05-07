"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { usePosterStore } from "@/store/posterStore";
import type { Layer } from "@/types/poster";

// Konva must be client-side only
const Stage = dynamic(
  () => import("react-konva").then((m) => m.Stage),
  { ssr: false }
);
const KonvaLayer = dynamic(
  () => import("react-konva").then((m) => m.Layer),
  { ssr: false }
);
const KonvaRect = dynamic(
  () => import("react-konva").then((m) => m.Rect),
  { ssr: false }
);
const KonvaText = dynamic(
  () => import("react-konva").then((m) => m.Text),
  { ssr: false }
);
const KonvaImage = dynamic(
  () => import("react-konva").then((m) => m.Image),
  { ssr: false }
);
const KonvaTransformer = dynamic(
  () => import("react-konva").then((m) => m.Transformer),
  { ssr: false }
);
const KonvaGroup = dynamic(
  () => import("react-konva").then((m) => m.Group),
  { ssr: false }
);

// Scale factor: display at 50% for performance
const SCALE = 0.5;

export function PosterCanvas() {
  const { project, selectedLayerId, selectLayer, updateLayer, getSortedLayers } =
    usePosterStore();
  const stageRef = useRef<import("konva/lib/Stage").Stage | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const handleExport = useCallback(() => {
    if (!stageRef.current) return;
    const stage = stageRef.current;
    const scale = stage.scaleX();
    // Temporarily scale to 1x for full-res export
    stage.scale({ x: 1, y: 1 });
    stage.size({
      width: project!.canvas.width,
      height: project!.canvas.height,
    });
    const uri = stage.toDataURL({ pixelRatio: 2 });
    stage.scale({ x: scale, y: scale });
    stage.size({
      width: project!.canvas.width * SCALE,
      height: project!.canvas.height * SCALE,
    });
    const link = document.createElement("a");
    link.download = `${project!.title}.png`;
    link.href = uri;
    link.click();
  }, [project]);

  // Expose export globally for toolbar
  useEffect(() => {
    (window as Window & { __posterExport?: () => void }).__posterExport =
      handleExport;
  }, [handleExport]);

  if (!ready || !project) return null;

  const displayW = project.canvas.width * SCALE;
  const displayH = project.canvas.height * SCALE;
  const sortedLayers = getSortedLayers();

  return (
    <div
      className="relative shadow-2xl"
      style={{
        width: displayW,
        height: displayH,
        background: "#111",
      }}
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
          {/* Background rect */}
          <KonvaRect
            x={0}
            y={0}
            width={project.canvas.width}
            height={project.canvas.height}
            fill="#000000"
          />

          {sortedLayers
            .filter((l) => l.visible)
            .map((layer) => (
              <LayerNode
                key={layer.id}
                layer={layer}
                selected={selectedLayerId === layer.id}
                onSelect={() => !layer.locked && selectLayer(layer.id)}
                onChange={(attrs) => updateLayer(layer.id, attrs)}
              />
            ))}
        </KonvaLayer>
      </Stage>

      {/* Export button overlay */}
      <button
        onClick={handleExport}
        className="absolute bottom-3 right-3 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 text-xs px-3 py-1.5 rounded-lg backdrop-blur transition-colors"
      >
        Export PNG
      </button>
    </div>
  );
}

function LayerNode({
  layer,
  selected,
  onSelect,
  onChange,
}: {
  layer: Layer;
  selected: boolean;
  onSelect: () => void;
  onChange: (attrs: Partial<Layer>) => void;
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
        x: () => number;
        y: () => number;
        scaleX: () => number;
        scaleY: () => number;
        rotation: () => number;
        width: () => number;
        height: () => number;
        setAttrs: (a: Record<string, number>) => void;
      };
    }) => {
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.setAttrs({ scaleX: 1, scaleY: 1 });
      onChange({
        x: node.x(),
        y: node.y(),
        width: Math.max(5, node.width() * scaleX),
        height: Math.max(5, node.height() * scaleY),
        rotation: node.rotation(),
      });
    },
  };

  if (
    layer.type === "background-image" ||
    layer.type === "foreground-cutout" ||
    layer.type === "user-image"
  ) {
    return (
      <KonvaImageLayer
        layer={layer}
        selected={selected}
        commonProps={commonProps}
        shapeRef={shapeRef as React.MutableRefObject<import("konva/lib/shapes/Image").Image | null>}
        transformerRef={transformerRef}
      />
    );
  }

  // Text layer
  const td = layer.textData!;
  return (
    <>
      <KonvaText
        ref={shapeRef as React.MutableRefObject<import("konva/lib/shapes/Text").Text | null>}
        {...commonProps}
        width={layer.width}
        text={td.text}
        fontSize={td.fontSize}
        fontFamily={td.fontFamily}
        fontStyle={td.fontStyle}
        fill={td.fill}
        align={td.align}
        letterSpacing={td.letterSpacing}
        lineHeight={td.lineHeight}
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

function KonvaImageLayer({
  layer,
  selected,
  commonProps,
  shapeRef,
  transformerRef,
}: {
  layer: Layer;
  selected: boolean;
  commonProps: Record<string, unknown>;
  shapeRef: React.MutableRefObject<import("konva/lib/shapes/Image").Image | null>;
  transformerRef: React.MutableRefObject<import("konva/lib/shapes/Transformer").Transformer | null>;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const src = layer.imageData?.src;

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => setImage(img);
  }, [src]);

  if (!src || !image) {
    // Placeholder rect
    return (
      <KonvaRect
        x={layer.x}
        y={layer.y}
        width={layer.width}
        height={layer.height}
        fill={layer.type === "background-image" ? "#1a1a2e" : "#2a1a2e"}
        stroke={selected ? "#7c3aed" : "transparent"}
        strokeWidth={2}
        opacity={layer.opacity}
        draggable={!layer.locked}
        onClick={commonProps.onClick as () => void}
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
      {selected && (
        <KonvaTransformer
          ref={transformerRef}
          rotateEnabled
          keepRatio={false}
        />
      )}
    </>
  );
}
