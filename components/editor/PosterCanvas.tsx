"use client";
// react-konva requires a browser environment. Importing directly in a
// "use client" file is safe because Next.js never runs "use client"
// modules on the server. The `ready` guard below additionally ensures
// Konva elements are only rendered after the component has mounted.
import { useRef, useEffect, useState, useCallback } from "react";
import {
  Stage,
  Layer as KonvaLayer,
  Rect as KonvaRect,
  Text as KonvaText,
  Image as KonvaImage,
  Transformer as KonvaTransformer,
} from "react-konva";
import { usePosterStore } from "@/store/posterStore";
import { CanvasErrorBoundary } from "./CanvasErrorBoundary";
import type { PosterLayer } from "@/types/poster";
import { getGradientPreset, gradientPoints } from "@/lib/textEffects";

const SCALE = 0.5;

const SAFE_MARGIN = 48; // canvas coordinates

export function PosterCanvas({ showGuides = false }: { showGuides?: boolean }) {
  const { project, selectedLayerId, selectLayer, updateLayer, getSortedLayers } =
    usePosterStore();
  const stageRef = useRef<import("konva/lib/Stage").Stage | null>(null);
  const [ready, setReady] = useState(false);

  // Only mount Konva after the component has hydrated on the client
  // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <CanvasErrorBoundary>
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

            {/* Safe margin guide overlay */}
            {showGuides && (
              <KonvaRect
                x={SAFE_MARGIN}
                y={SAFE_MARGIN}
                width={project.canvas.width - SAFE_MARGIN * 2}
                height={project.canvas.height - SAFE_MARGIN * 2}
                fill="transparent"
                stroke="rgba(99,102,241,0.35)"
                strokeWidth={1}
                dash={[8, 8]}
                listening={false}
              />
            )}

            {sortedLayers
              .filter((l) => l.visible)
              .map((layer) => {
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
    </CanvasErrorBoundary>
  );
}

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

  const td = layer.textData;
  if (!td) {
    console.warn("PosterCanvas: text layer missing textData", layer.id, layer.type);
    return null;
  }

  // Gradient fill
  const gradientPreset = td.fillGradient ? getGradientPreset(td.fillGradient) : undefined;
  const useGradient = !!gradientPreset && gradientPreset.colorStops.length > 0;
  const gradientProps = useGradient
    ? (() => {
        const { start, end } = gradientPoints(gradientPreset!.angle, layer.width, layer.height);
        return {
          fillLinearGradientStartPoint: start,
          fillLinearGradientEndPoint: end,
          fillLinearGradientColorStops: gradientPreset!.colorStops as (number | string)[],
        };
      })()
    : {};

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
        {...gradientProps}
        align={td.align ?? "left"}
        letterSpacing={td.letterSpacing ?? 0}
        lineHeight={td.lineHeight ?? 1.2}
        wrap="word"
        textDecoration={td.textDecoration ?? ""}
        stroke={td.stroke}
        strokeWidth={td.strokeWidth}
        shadowEnabled={td.shadowEnabled ?? false}
        shadowColor={td.shadowColor ?? "#000000"}
        shadowOffsetX={td.shadowOffsetX ?? 0}
        shadowOffsetY={td.shadowOffsetY ?? 0}
        shadowBlur={td.shadowBlur ?? 0}
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!src) { setImage(null); setImgError(false); return; }
    setImgError(false);
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => setImage(img);
    img.onerror = () => {
      console.warn("PosterCanvas: image failed to load", src.slice(0, 80));
      setImgError(true);
      setImage(null);
    };
  }, [src]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
        onDragEnd={commonProps.onDragEnd as (e: { target: { x: () => number; y: () => number } }) => void}
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
