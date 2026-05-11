"use client";
// react-konva requires a browser environment — safe in "use client" files.
import { useRef, useEffect, useState, useCallback } from "react";
import {
  Stage,
  Layer as KonvaLayer,
  Rect as KonvaRect,
  Text as KonvaText,
  Image as KonvaImage,
  Transformer as KonvaTransformer,
  Circle as KonvaCircle,
  Line as KonvaLine,
} from "react-konva";
import { usePosterStore } from "@/store/posterStore";
import { CanvasErrorBoundary } from "./CanvasErrorBoundary";
import type { PosterLayer, GradientLayerData } from "@/types/poster";
import { getGradientPreset, gradientPoints } from "@/lib/textEffects";

const SAFE_MARGIN = 48;

export function PosterCanvas({ showGuides = false }: { showGuides?: boolean }) {
  const { project, selectedLayerId, selectLayer, updateLayer, getSortedLayers } =
    usePosterStore();
  const stageRef = useRef<import("konva/lib/Stage").Stage | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [containerSize, setContainerSize] = useState({ w: 900, h: 600 });
  const [zoom, setZoom] = useState(0.45);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStartRef = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const isPanningRef = useRef(false);
  const isSpaceRef = useRef(false);

  useEffect(() => { setReady(true); }, []);

  // Measure container with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setContainerSize({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const fitToView = useCallback(() => {
    if (!project) return;
    const { w, h } = containerSize;
    const { width: cW, height: cH } = project.canvas;
    const z = Math.min(w / cW, h / cH) * 0.85;
    setZoom(z);
    setPan({ x: (w - cW * z) / 2, y: (h - cH * z) / 2 });
  }, [project, containerSize]);

  // Center canvas when project or container size changes
  useEffect(() => {
    fitToView();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.canvas.width, project?.canvas.height, containerSize.w, containerSize.h]);

  // Space key for pan mode
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        isSpaceRef.current = true;
      }
      // Keyboard zoom
      if ((e.metaKey || e.ctrlKey) && e.key === "=") { e.preventDefault(); setZoom(z => Math.min(4, z * 1.2)); }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") { e.preventDefault(); setZoom(z => Math.max(0.08, z / 1.2)); }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") { e.preventDefault(); fitToView(); }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") { isSpaceRef.current = false; isPanningRef.current = false; }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, [fitToView]);

  // Wheel zoom toward cursor
  function handleWheel(e: import("konva/lib/Node").KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition()!;
    const oldZoom = zoom;
    const direction = e.evt.deltaY < 0 ? 1 : -1;
    const factor = 1 + 0.08 * Math.min(Math.abs(e.evt.deltaY / 100), 3);
    const newZoom = direction > 0
      ? Math.min(4, oldZoom * factor)
      : Math.max(0.08, oldZoom / factor);
    const mousePointTo = {
      x: (pointer.x - pan.x) / oldZoom,
      y: (pointer.y - pan.y) / oldZoom,
    };
    setZoom(newZoom);
    setPan({ x: pointer.x - mousePointTo.x * newZoom, y: pointer.y - mousePointTo.y * newZoom });
  }

  // Stage mouse events for space+drag pan
  function handleMouseDown(e: import("konva/lib/Node").KonvaEventObject<MouseEvent>) {
    if (isSpaceRef.current) {
      e.evt.preventDefault();
      isPanningRef.current = true;
      panStartRef.current = { mx: e.evt.clientX, my: e.evt.clientY, px: pan.x, py: pan.y };
    }
  }
  function handleMouseMove(e: import("konva/lib/Node").KonvaEventObject<MouseEvent>) {
    if (!isPanningRef.current) return;
    const dx = e.evt.clientX - panStartRef.current.mx;
    const dy = e.evt.clientY - panStartRef.current.my;
    setPan({ x: panStartRef.current.px + dx, y: panStartRef.current.py + dy });
  }
  function handleMouseUp() { isPanningRef.current = false; }

  // Export at full canvas resolution by temporarily resetting Stage transform
  const handleExport = useCallback(() => {
    if (!stageRef.current || !project) return;
    const stage = stageRef.current;
    const cW = project.canvas.width;
    const cH = project.canvas.height;
    // Save current state
    const prevScale = stage.scaleX();
    const prevX = stage.x();
    const prevY = stage.y();
    const prevW = stage.width();
    const prevH = stage.height();
    // Set to canvas resolution
    stage.x(0); stage.y(0);
    stage.scale({ x: 1, y: 1 });
    stage.size({ width: cW, height: cH });
    const uri = stage.toDataURL({ pixelRatio: 2 });
    // Restore
    stage.scale({ x: prevScale, y: prevScale });
    stage.x(prevX); stage.y(prevY);
    stage.size({ width: prevW, height: prevH });
    const link = document.createElement("a");
    link.download = `${project.title}.png`;
    link.href = uri;
    link.click();
  }, [project]);

  useEffect(() => {
    (window as Window & { __posterExport?: () => void }).__posterExport = handleExport;
  }, [handleExport]);

  if (!project) return null;

  const sortedLayers = getSortedLayers();

  return (
    <CanvasErrorBoundary>
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ cursor: isSpaceRef.current ? "grab" : "default", overflow: "hidden" }}
      >
        {ready && (
          <Stage
            ref={stageRef}
            width={containerSize.w}
            height={containerSize.h}
            x={pan.x}
            y={pan.y}
            scaleX={zoom}
            scaleY={zoom}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
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
                listening={false}
              />

              {/* Safe margin guides */}
              {showGuides && (
                <KonvaRect
                  x={SAFE_MARGIN} y={SAFE_MARGIN}
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
                  if (!layer?.id || !layer.type) return null;
                  try {
                    return (
                      <PosterLayerNode
                        key={layer.id}
                        layer={layer}
                        selected={selectedLayerId === layer.id}
                        onSelect={() => !layer.locked && selectLayer(layer.id)}
                        onChange={(attrs) => updateLayer(layer.id, attrs)}
                      />
                    );
                  } catch (err) {
                    console.error("[PosterCanvas] Layer render error:", err, layer);
                    return null;
                  }
                })}
            </KonvaLayer>
          </Stage>
        )}

        {/* Canvas outline (visible when zoomed out) */}
        {ready && (
          <div
            className="pointer-events-none absolute"
            style={{
              left: pan.x,
              top: pan.y,
              width: project.canvas.width * zoom,
              height: project.canvas.height * zoom,
              outline: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.8), 0 8px 40px rgba(0,0,0,0.6)",
            }}
          />
        )}

        {/* Drawing overlay */}
        {ready && (
          <DrawingOverlay
            containerW={containerSize.w}
            containerH={containerSize.h}
            canvasW={project.canvas.width}
            canvasH={project.canvas.height}
            pan={pan}
            zoom={zoom}
          />
        )}

        {/* Zoom controls */}
        <ZoomControls zoom={zoom} onZoomIn={() => setZoom(z => Math.min(4, z * 1.2))} onZoomOut={() => setZoom(z => Math.max(0.08, z / 1.2))} onFit={fitToView} />
      </div>
    </CanvasErrorBoundary>
  );
}

// ─── Zoom controls overlay ─────────────────────────────────────────────────────

function ZoomControls({ zoom, onZoomIn, onZoomOut, onFit }: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) {
  return (
    <div
      className="absolute bottom-4 right-4 flex items-center gap-px z-10"
      style={{
        background: "rgba(12,12,14,0.82)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(12px)",
        borderRadius: 6,
      }}
    >
      <button
        onClick={onZoomOut}
        title="Zoom out (⌘-)"
        className="w-7 h-7 flex items-center justify-center font-mono text-[13px] text-zinc-400 hover:text-zinc-100 transition-colors"
      >
        −
      </button>
      <button
        onClick={onFit}
        title="Fit to view (⌘0)"
        className="px-2 h-7 font-mono text-[9px] tracking-wide text-zinc-500 hover:text-zinc-200 transition-colors"
        style={{ borderLeft: "1px solid rgba(255,255,255,0.07)", borderRight: "1px solid rgba(255,255,255,0.07)" }}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        onClick={onZoomIn}
        title="Zoom in (⌘+)"
        className="w-7 h-7 flex items-center justify-center font-mono text-[13px] text-zinc-400 hover:text-zinc-100 transition-colors"
      >
        +
      </button>
    </div>
  );
}

// ─── Layer node ────────────────────────────────────────────────────────────────

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

  // Konva's globalCompositeOperation accepts a specific union — cast explicitly
  type GCO = "multiply" | "screen" | "overlay" | "soft-light" | "hard-light" |
    "color-dodge" | "color-burn" | "darken" | "lighten" | "color" |
    "luminosity" | "difference" | "exclusion";
  const gco: GCO | undefined = (layer.blendMode && layer.blendMode !== "normal")
    ? (layer.blendMode as GCO)
    : undefined;
  const blendProp = gco ? { globalCompositeOperation: gco } : {};

  const commonProps = {
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    opacity: layer.opacity,
    draggable: !layer.locked,
    onClick: onSelect,
    onTap: onSelect,
    onDragStart: () => usePosterStore.getState().pushHistory(),
    onDragEnd: (e: { target: { x: () => number; y: () => number } }) =>
      onChange({ x: e.target.x(), y: e.target.y() }),
    onTransformStart: () => usePosterStore.getState().pushHistory(),
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

  // New layer types — handle before the legacy gradientLayer check
  if (layer.type === "colorOverlay") {
    return <ColorOverlayNode layer={layer} selected={selected} commonProps={{ ...commonProps, ...blendProp }} />;
  }
  if (layer.type === "noiseTexture") {
    return <NoiseTextureNode layer={layer} selected={selected} commonProps={{ ...commonProps, ...blendProp }} />;
  }
  if (layer.type === "geometricShape" || layer.type === "accentLine") {
    return <ShapeLayerNode layer={layer} selected={selected} commonProps={{ ...commonProps, ...blendProp }} />;
  }

  // gradientLayer renders as a native Konva gradient rect — not a KonvaImageNode
  if (layer.type === "gradientLayer") {
    return (
      <GradientLayerNode
        layer={layer}
        selected={selected}
        commonProps={{ ...commonProps, ...blendProp }}
      />
    );
  }

  const isImageType =
    layer.type === "backgroundImage" ||
    layer.type === "subjectImage" ||
    layer.type === "foregroundCutout" ||
    layer.type === "userImage" ||
    layer.type === "drawingLayer" ||
    layer.type === "textureLayer" ||
    layer.type === "logoPlaceholder";

  if (isImageType) {
    return (
      <KonvaImageNode
        layer={layer}
        selected={selected}
        commonProps={{ ...commonProps, ...blendProp }}
        shapeRef={shapeRef as React.MutableRefObject<import("konva/lib/shapes/Image").Image | null>}
        transformerRef={transformerRef}
      />
    );
  }

  const td = layer.textData;
  if (!td || typeof td.text !== "string") return null;

  // Apply textTransform
  const displayText = td.textTransform === "uppercase" ? td.text?.toUpperCase()
    : td.textTransform === "lowercase" ? td.text?.toLowerCase()
    : td.text ?? "";

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

  // Vertical writing mode: rotate -90 degrees and reposition
  const isVertical = td.writingMode === "vertical";
  const textCommonProps = isVertical
    ? {
        ...commonProps,
        ...blendProp,
        x: layer.x + (layer.width || 20),
        y: layer.y,
        rotation: (layer.rotation || 0) - 90,
      }
    : { ...commonProps, ...blendProp };

  return (
    <>
      <KonvaText
        ref={shapeRef as React.MutableRefObject<import("konva/lib/shapes/Text").Text | null>}
        {...textCommonProps}
        width={layer.width}
        text={displayText}
        fontSize={td.fontSize ?? 24}
        fontFamily={td.fontFamily ?? "Arial"}
        fontStyle={td.fontStyle ?? "normal"}
        fill={useGradient ? undefined : (td.fill ?? "#ffffff")}
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
            usePosterStore.getState().pushHistory();
            usePosterStore.getState().updateTextData(layer.id, { text: newText });
          }
        }}
      />
      {selected && <KonvaTransformer ref={transformerRef} rotateEnabled keepRatio={false} />}
    </>
  );
}

// ─── Color overlay node ────────────────────────────────────────────────────────

function ColorOverlayNode({
  layer,
  selected,
  commonProps,
}: {
  layer: PosterLayer;
  selected: boolean;
  commonProps: Record<string, unknown>;
}) {
  const shapeRef = useRef<import("konva/lib/shapes/Rect").Rect | null>(null);
  const transformerRef =
    useRef<import("konva/lib/shapes/Transformer").Transformer | null>(null);

  useEffect(() => {
    if (selected && transformerRef.current && shapeRef.current) {
      transformerRef.current.nodes([shapeRef.current as never]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selected]);

  const od = layer.overlayData;
  const w = layer.width;
  const h = layer.height;
  let fillProps: Record<string, unknown> = {};

  if (od) {
    if (od.gradientType === "radial") {
      fillProps = {
        fillRadialGradientStartPoint: { x: w / 2, y: h / 2 },
        fillRadialGradientStartRadius: 0,
        fillRadialGradientEndPoint: { x: w / 2, y: h / 2 },
        fillRadialGradientEndRadius: Math.max(w, h) * 0.7,
        fillRadialGradientColorStops: od.colors.flatMap((c, i) => [i / Math.max(od.colors.length - 1, 1), c]),
      };
    } else {
      const rad = ((od.direction - 90) * Math.PI) / 180;
      const len = Math.sqrt(w * w + h * h) / 2;
      fillProps = {
        fillLinearGradientStartPoint: { x: w / 2 - Math.cos(rad) * len, y: h / 2 - Math.sin(rad) * len },
        fillLinearGradientEndPoint: { x: w / 2 + Math.cos(rad) * len, y: h / 2 + Math.sin(rad) * len },
        fillLinearGradientColorStops: od.colors.flatMap((c, i) => [i / Math.max(od.colors.length - 1, 1), c]),
      };
    }
  } else {
    fillProps = { fill: "rgba(0,0,0,0.5)" };
  }

  return (
    <>
      <KonvaRect ref={shapeRef} {...commonProps} width={w} height={h} {...fillProps} />
      {selected && <KonvaTransformer ref={transformerRef} rotateEnabled keepRatio={false} />}
    </>
  );
}

// ─── Noise texture node ────────────────────────────────────────────────────────

function NoiseTextureNode({
  layer,
  selected,
  commonProps,
}: {
  layer: PosterLayer;
  selected: boolean;
  commonProps: Record<string, unknown>;
}) {
  const [noiseImg, setNoiseImg] = useState<HTMLImageElement | null>(null);
  const shapeRef = useRef<import("konva/lib/shapes/Image").Image | null>(null);
  const transformerRef =
    useRef<import("konva/lib/shapes/Transformer").Transformer | null>(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    // Use a small tile (128x128) for performance, tiled across the layer
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.createImageData(128, 128);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      imageData.data[i] = v;
      imageData.data[i + 1] = v;
      imageData.data[i + 2] = v;
      imageData.data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    const img = new window.Image();
    img.src = canvas.toDataURL();
    img.onload = () => setNoiseImg(img);
  }, []);

  useEffect(() => {
    if (selected && transformerRef.current && shapeRef.current) {
      transformerRef.current.nodes([shapeRef.current as never]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selected]);

  if (!noiseImg) return null;

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        {...commonProps}
        image={noiseImg}
        width={layer.width}
        height={layer.height}
      />
      {selected && <KonvaTransformer ref={transformerRef} rotateEnabled keepRatio={false} />}
    </>
  );
}

// ─── Shape layer node ──────────────────────────────────────────────────────────

function ShapeLayerNode({
  layer,
  selected,
  commonProps,
}: {
  layer: PosterLayer;
  selected: boolean;
  commonProps: Record<string, unknown>;
}) {
  const sd = layer.shapeData;
  const shapeRef = useRef<
    | import("konva/lib/shapes/Rect").Rect
    | import("konva/lib/shapes/Circle").Circle
    | import("konva/lib/shapes/Line").Line
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

  if (!sd) {
    // Default: thin white rect
    return (
      <>
        <KonvaRect
          {...commonProps}
          width={layer.width}
          height={Math.max(1, layer.height)}
          fill="#ffffff"
        />
        {selected && <KonvaTransformer ref={transformerRef} rotateEnabled keepRatio={false} />}
      </>
    );
  }

  if (sd.shapeType === "circle") {
    const r = Math.min(layer.width, layer.height) / 2;
    return (
      <>
        <KonvaCircle
          ref={shapeRef as React.MutableRefObject<import("konva/lib/shapes/Circle").Circle | null>}
          {...commonProps}
          x={layer.x + r} y={layer.y + r}
          radius={r}
          fill={sd.fill === "none" ? undefined : sd.fill}
          stroke={sd.stroke}
          strokeWidth={sd.strokeWidth}
        />
        {selected && <KonvaTransformer ref={transformerRef} rotateEnabled keepRatio={false} />}
      </>
    );
  }

  if (sd.shapeType === "line") {
    return (
      <>
        <KonvaLine
          ref={shapeRef as React.MutableRefObject<import("konva/lib/shapes/Line").Line | null>}
          {...commonProps}
          x={layer.x} y={layer.y}
          points={[0, 0, layer.width, 0]}
          stroke={sd.stroke || "#ffffff"}
          strokeWidth={sd.strokeWidth || 1}
        />
        {selected && <KonvaTransformer ref={transformerRef} rotateEnabled keepRatio={false} />}
      </>
    );
  }

  // Default: rect
  return (
    <>
      <KonvaRect
        ref={shapeRef as React.MutableRefObject<import("konva/lib/shapes/Rect").Rect | null>}
        {...commonProps}
        width={layer.width}
        height={layer.height}
        fill={sd.fill === "none" ? undefined : sd.fill}
        stroke={sd.stroke}
        strokeWidth={sd.strokeWidth}
        cornerRadius={sd.cornerRadius ?? 0}
      />
      {selected && <KonvaTransformer ref={transformerRef} rotateEnabled keepRatio={false} />}
    </>
  );
}

// ─── Image node ────────────────────────────────────────────────────────────────

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
    img.onerror = () => { setImgError(true); setImage(null); };
  }, [src]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!src) return null;
  const isBg = layer.type === "backgroundImage" || layer.type === "subjectImage";

  if (imgError) {
    return (
      <KonvaRect
        x={layer.x} y={layer.y}
        width={layer.width} height={layer.height}
        fill={isBg ? "#0a0a0a" : "#2a0a0a"}
        stroke={selected ? "#71717a" : "rgba(180,0,0,0.4)"}
        strokeWidth={2}
        opacity={layer.opacity}
        draggable={!layer.locked}
        onClick={commonProps.onClick as () => void}
        onTap={commonProps.onTap as () => void}
        onDragEnd={commonProps.onDragEnd as (e: { target: { x: () => number; y: () => number } }) => void}
      />
    );
  }

  if (!image) {
    if (!isBg) return null;
    return (
      <KonvaRect
        x={layer.x} y={layer.y}
        width={layer.width} height={layer.height}
        fill="#0a0a0a"
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

// ─── Gradient layer node ──────────────────────────────────────────────────────

function GradientLayerNode({
  layer,
  selected,
  commonProps,
}: {
  layer: PosterLayer;
  selected: boolean;
  commonProps: Record<string, unknown>;
}) {
  const shapeRef = useRef<import("konva/lib/shapes/Rect").Rect | null>(null);
  const transformerRef =
    useRef<import("konva/lib/shapes/Transformer").Transformer | null>(null);

  useEffect(() => {
    if (selected && transformerRef.current && shapeRef.current) {
      transformerRef.current.nodes([shapeRef.current as never]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selected]);

  const gd: GradientLayerData | undefined = layer.gradientData;
  const w = layer.width;
  const h = layer.height;

  let fillProps: Record<string, unknown> = { fill: "rgba(80,40,160,0.4)" };

  if (gd) {
    const stops = gd.stops.flatMap((s) => [s.offset, s.color]);

    if (gd.gradientType === "radial") {
      const cx = w / 2;
      const cy = h / 2;
      fillProps = {
        fillRadialGradientStartPoint: { x: cx, y: cy },
        fillRadialGradientStartRadius: 0,
        fillRadialGradientEndPoint: { x: cx, y: cy },
        fillRadialGradientEndRadius: Math.max(w, h) * 0.7,
        fillRadialGradientColorStops: stops,
      };
    } else {
      const rad = ((gd.angle - 90) * Math.PI) / 180;
      const len = (Math.sqrt(w * w + h * h) / 2) * 1.05;
      const cx = w / 2;
      const cy = h / 2;
      fillProps = {
        fillLinearGradientStartPoint: { x: cx - Math.cos(rad) * len, y: cy - Math.sin(rad) * len },
        fillLinearGradientEndPoint:   { x: cx + Math.cos(rad) * len, y: cy + Math.sin(rad) * len },
        fillLinearGradientColorStops: stops,
      };
    }
  }

  return (
    <>
      <KonvaRect
        ref={shapeRef}
        {...commonProps}
        width={w}
        height={h}
        {...fillProps}
      />
      {selected && (
        <KonvaTransformer ref={transformerRef} rotateEnabled keepRatio={false} />
      )}
    </>
  );
}

// ─── Drawing overlay ──────────────────────────────────────────────────────────

function DrawingOverlay({
  containerW,
  containerH,
  canvasW,
  canvasH,
  pan,
  zoom,
}: {
  containerW: number;
  containerH: number;
  canvasW: number;
  canvasH: number;
  pan: { x: number; y: number };
  zoom: number;
}) {
  const { brushActive, brushColor, brushSize, brushOpacity, getSortedLayers } = usePosterStore();

  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  function canvasToLocal(displayX: number, displayY: number) {
    // Convert display coords → canvas coords
    return {
      x: (displayX - pan.x) / zoom,
      y: (displayY - pan.y) / zoom,
    };
  }
  // Suppress unused warning — canvasToLocal used conceptually, keep for future
  void canvasToLocal;

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    lastPointRef.current = { x: cx, y: cy };
    // Draw dot
    const ctx = liveCanvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.globalAlpha = brushOpacity;
      ctx.fillStyle = brushColor;
      ctx.beginPath();
      ctx.arc(cx, cy, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const curr = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const ctx = liveCanvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.globalAlpha = brushOpacity;
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.stroke();
    }
    lastPointRef.current = curr;
  }

  function handlePointerUp() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    void commitStroke();
  }

  async function commitStroke() {
    const liveCanvas = liveCanvasRef.current;
    if (!liveCanvas) return;

    const snapshot = document.createElement("canvas");
    snapshot.width = liveCanvas.width;
    snapshot.height = liveCanvas.height;
    snapshot.getContext("2d")?.drawImage(liveCanvas, 0, 0);
    liveCanvas.getContext("2d")?.clearRect(0, 0, liveCanvas.width, liveCanvas.height);

    const drawingLayer = getSortedLayers().find((l) => l.type === "drawingLayer");
    if (!drawingLayer) return;

    const existingSrc = drawingLayer.imageData?.src ?? "";
    const offscreen = document.createElement("canvas");
    offscreen.width = canvasW;
    offscreen.height = canvasH;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;

    if (existingSrc) {
      await new Promise<void>((resolve) => {
        const img = new window.Image();
        img.onload = () => { offCtx.drawImage(img, 0, 0); resolve(); };
        img.onerror = () => resolve();
        img.src = existingSrc;
      });
    }

    // Transform: snapshot is in display coords, map to canvas space
    offCtx.save();
    offCtx.translate(-pan.x / zoom, -pan.y / zoom);
    offCtx.scale(1 / zoom, 1 / zoom);
    offCtx.drawImage(snapshot, 0, 0);
    offCtx.restore();

    const dataUrl = offscreen.toDataURL("image/png");
    const store = usePosterStore.getState();
    store.pushHistory();
    store.updateLayer(drawingLayer.id, { imageData: { src: dataUrl, fit: "fill" } });
  }

  if (!brushActive) return null;

  return (
    <canvas
      ref={liveCanvasRef}
      width={containerW}
      height={containerH}
      style={{
        position: "absolute",
        top: 0, left: 0,
        width: containerW,
        height: containerH,
        cursor: "crosshair",
        touchAction: "none",
        zIndex: 5,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
}
