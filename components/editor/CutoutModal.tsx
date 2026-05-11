"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { usePosterStore } from "@/store/posterStore";
import type { PosterLayer, AssetItem } from "@/types/poster";

// Checkerboard CSS background for transparency areas
const CHECKER = `repeating-conic-gradient(#2a2a2a 0% 25%, #181818 0% 50%) 0 0 / 16px 16px`;

// Canvas pixel dimensions (display canvas — not natural image size)
const CW = 520;
const CH = 400;

type CutoutMode = "auto" | "lasso" | "brush";
type AutoStatus = "idle" | "extracting" | "done" | "failed";
interface Pt { x: number; y: number }
interface ImgRect { x: number; y: number; w: number; h: number }

// ─── Main modal ───────────────────────────────────────────────────────────────

export function CutoutModal({
  sourceLayerId,
  onClose,
}: {
  sourceLayerId: string;
  onClose: () => void;
}) {
  const { getLayerById, addLayer, addAsset, pushHistory, project } = usePosterStore();
  const sourceLayer = getLayerById(sourceLayerId);
  const imageSrc = sourceLayer?.imageData?.src ?? "";

  const [mode, setMode] = useState<CutoutMode>("auto");

  // Per-mode preview URLs — kept independent so switching tabs never clears results
  const [autoPreviewUrl,  setAutoPreviewUrl]  = useState<string | null>(null);
  const [lassoPreviewUrl, setLassoPreviewUrl] = useState<string | null>(null);
  const [brushPreviewUrl, setBrushPreviewUrl] = useState<string | null>(null);
  const autoObjectUrl = useRef<string | null>(null); // for revoking on reset

  // ─── Auto state ────────────────────────────────────────────────────────────
  const [autoStatus,   setAutoStatus]   = useState<AutoStatus>("idle");
  const [autoProgress, setAutoProgress] = useState(0);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      if (autoObjectUrl.current) URL.revokeObjectURL(autoObjectUrl.current);
    };
  }, []);

  // ─── Lasso state ───────────────────────────────────────────────────────────
  const lassoRef    = useRef<HTMLCanvasElement>(null);
  const lassoImgEl  = useRef<HTMLImageElement | null>(null);
  const lassoIR     = useRef<ImgRect>({ x: 0, y: 0, w: CW, h: CH });
  const lassoNatW   = useRef(1);
  const lassoNatH   = useRef(1);
  const [lassoPoints, setLassoPoints] = useState<Pt[]>([]);
  const [isLassoing, setIsLassoing]   = useState(false);
  const [lassoSnap,  setLassoSnap]    = useState(false);

  // ─── Brush state ───────────────────────────────────────────────────────────
  const brushRef    = useRef<HTMLCanvasElement>(null);
  const brushImgEl  = useRef<HTMLImageElement | null>(null);
  const brushIR     = useRef<ImgRect>({ x: 0, y: 0, w: CW, h: CH });
  const brushNatW   = useRef(1);
  const brushNatH   = useRef(1);
  const origData    = useRef<ImageData | null>(null);
  const [brushMode, setBrushMode] = useState<"erase" | "restore">("erase");
  const [brushSize, setBrushSize] = useState(28);
  const [isBrushing, setIsBrushing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [cursorPx, setCursorPx] = useState<Pt | null>(null);

  // Keyboard close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // ─── Image loader ──────────────────────────────────────────────────────────

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function fitRect(natW: number, natH: number): ImgRect {
    const scale = Math.min(CW / natW, CH / natH);
    const w = natW * scale;
    const h = natH * scale;
    return { x: (CW - w) / 2, y: (CH - h) / 2, w, h };
  }

  // ─── Init lasso canvas ─────────────────────────────────────────────────────

  useEffect(() => {
    if (mode !== "lasso" || !imageSrc) return;
    let cancelled = false;
    loadImage(imageSrc).then((img) => {
      if (cancelled) return;
      const ir = fitRect(img.naturalWidth, img.naturalHeight);
      lassoIR.current   = ir;
      lassoNatW.current = img.naturalWidth;
      lassoNatH.current = img.naturalHeight;
      lassoImgEl.current = img;
      const canvas = lassoRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, CW, CH);
      ctx.drawImage(img, ir.x, ir.y, ir.w, ir.h);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [mode, imageSrc]);

  // ─── Init brush canvas ─────────────────────────────────────────────────────

  useEffect(() => {
    if (mode !== "brush" || !imageSrc) return;
    let cancelled = false;
    loadImage(imageSrc).then((img) => {
      if (cancelled) return;
      const ir = fitRect(img.naturalWidth, img.naturalHeight);
      brushIR.current    = ir;
      brushNatW.current  = img.naturalWidth;
      brushNatH.current  = img.naturalHeight;
      brushImgEl.current = img;
      const canvas = brushRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.clearRect(0, 0, CW, CH);
      ctx.drawImage(img, ir.x, ir.y, ir.w, ir.h);
      try { origData.current = ctx.getImageData(0, 0, CW, CH); } catch { origData.current = null; }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [mode, imageSrc]);

  // ─── Redraw lasso canvas ───────────────────────────────────────────────────

  const redrawLasso = useCallback(() => {
    const canvas = lassoRef.current;
    const img    = lassoImgEl.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    const { x, y, w, h } = lassoIR.current;

    ctx.clearRect(0, 0, CW, CH);
    ctx.drawImage(img, x, y, w, h);

    if (lassoPoints.length === 0) return;

    if (lassoPoints.length === 1) {
      ctx.beginPath();
      ctx.arc(lassoPoints[0].x, lassoPoints[0].y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
      return;
    }

    ctx.save();
    ctx.fillStyle = "rgba(96,165,250,0.18)";
    ctx.beginPath();
    lassoPoints.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    lassoPoints.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    const s = lassoPoints[0];
    ctx.save();
    ctx.fillStyle = lassoSnap ? "#60a5fa" : "white";
    ctx.beginPath();
    ctx.arc(s.x, s.y, lassoSnap ? 8 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, [lassoPoints, lassoSnap]);

  useEffect(() => { redrawLasso(); }, [redrawLasso]);

  // ─── Lasso coordinate helpers ──────────────────────────────────────────────

  function getCanvasPt(e: React.MouseEvent<HTMLCanvasElement>): Pt {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CW / rect.width),
      y: (e.clientY - rect.top)  * (CH / rect.height),
    };
  }

  function isNearStart(pt: Pt): boolean {
    if (lassoPoints.length < 3) return false;
    const s = lassoPoints[0];
    return Math.hypot(pt.x - s.x, pt.y - s.y) < 15;
  }

  // ─── Lasso pointer events ──────────────────────────────────────────────────

  function onLassoDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    setLassoPreviewUrl(null);
    setIsLassoing(true);
    setLassoPoints([getCanvasPt(e)]);
  }

  function onLassoMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isLassoing) return;
    const pt = getCanvasPt(e);
    const snap = isNearStart(pt);
    setLassoSnap(snap);
    if (!snap) setLassoPoints((prev) => [...prev, pt]);
  }

  async function onLassoUp() {
    if (!isLassoing) return;
    setIsLassoing(false);
    if (lassoPoints.length < 3) { setLassoPoints([]); return; }
    const url = await computeLassoCutout(lassoPoints);
    if (url) setLassoPreviewUrl(url);
  }

  async function computeLassoCutout(pts: Pt[]): Promise<string | null> {
    if (pts.length < 3) return null;
    const ir   = lassoIR.current;
    const natW = lassoNatW.current;
    const natH = lassoNatH.current;

    const natPts = pts.map((p) => ({
      x: ((p.x - ir.x) / ir.w) * natW,
      y: ((p.y - ir.y) / ir.h) * natH,
    }));

    return new Promise((resolve) => {
      const img = new Image();
      if (!imageSrc.startsWith("data:")) img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width  = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d")!;
        ctx.beginPath();
        natPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = () => resolve(null);
      img.src = imageSrc;
    });
  }

  function clearLasso() {
    setLassoPoints([]);
    setLassoSnap(false);
    setLassoPreviewUrl(null);
    const canvas = lassoRef.current;
    const img    = lassoImgEl.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    const { x, y, w, h } = lassoIR.current;
    ctx.clearRect(0, 0, CW, CH);
    ctx.drawImage(img, x, y, w, h);
  }

  // ─── Brush stroke application ──────────────────────────────────────────────

  function applyBrushStroke(pt: Pt) {
    const canvas = brushRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const r   = brushSize / 2;

    ctx.save();
    if (brushMode === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fill();
    } else if (brushMode === "restore" && origData.current) {
      const x0 = Math.max(0, Math.floor(pt.x - r));
      const y0 = Math.max(0, Math.floor(pt.y - r));
      const rw  = Math.min(CW - x0, Math.ceil(r * 2 + 1));
      const rh  = Math.min(CH - y0, Math.ceil(r * 2 + 1));
      if (rw > 0 && rh > 0) {
        const slice = new ImageData(rw, rh);
        const od    = origData.current;
        for (let iy = 0; iy < rh; iy++) {
          for (let ix = 0; ix < rw; ix++) {
            const si = ((y0 + iy) * od.width  + (x0 + ix)) * 4;
            const di = (iy * rw + ix) * 4;
            slice.data[di]     = od.data[si];
            slice.data[di + 1] = od.data[si + 1];
            slice.data[di + 2] = od.data[si + 2];
            slice.data[di + 3] = od.data[si + 3];
          }
        }
        const temp  = document.createElement("canvas");
        temp.width  = rw;
        temp.height = rh;
        temp.getContext("2d")!.putImageData(slice, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(temp, x0, y0);
      }
    }
    ctx.restore();
  }

  function onBrushDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    setIsBrushing(true);
    setHasStrokes(true);
    applyBrushStroke(getCanvasPt(e));
  }

  function onBrushMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setCursorPx({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (!isBrushing) return;
    applyBrushStroke(getCanvasPt(e));
  }

  function onBrushUp() {
    setIsBrushing(false);
    exportBrushPreview();
  }

  function exportBrushPreview() {
    const canvas = brushRef.current;
    if (!canvas) return;
    try { setBrushPreviewUrl(canvas.toDataURL("image/png")); } catch { /* CORS tainted */ }
  }

  async function getBrushCutoutFullRes(): Promise<string | null> {
    const canvas = brushRef.current;
    const img    = brushImgEl.current;
    if (!canvas || !img) return null;
    try {
      const out    = document.createElement("canvas");
      out.width    = img.naturalWidth;
      out.height   = img.naturalHeight;
      const ctx    = out.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const { x, y, w, h } = brushIR.current;
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(canvas, x, y, w, h, 0, 0, img.naturalWidth, img.naturalHeight);
      return out.toDataURL("image/png");
    } catch {
      try { return brushRef.current?.toDataURL("image/png") ?? null; } catch { return null; }
    }
  }

  function resetBrush() {
    const canvas = brushRef.current;
    const img    = brushImgEl.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const { x, y, w, h } = brushIR.current;
    ctx.clearRect(0, 0, CW, CH);
    ctx.drawImage(img, x, y, w, h);
    setHasStrokes(false);
    setBrushPreviewUrl(null);
  }

  // ─── Auto extraction (local AI — @imgly/background-removal) ───────────────

  async function handleAutoExtract() {
    setAutoStatus("extracting");
    setAutoProgress(0);

    // Revoke any previous object URL
    if (autoObjectUrl.current) {
      URL.revokeObjectURL(autoObjectUrl.current);
      autoObjectUrl.current = null;
    }
    setAutoPreviewUrl(null);

    try {
      // Convert imageSrc to Blob
      let blob: Blob;
      if (imageSrc.startsWith("data:")) {
        const [header, b64] = imageSrc.split(",");
        const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
        const bin  = atob(b64);
        const arr  = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        blob = new Blob([arr], { type: mime });
      } else {
        blob = await fetch(imageSrc).then((r) => r.blob());
      }

      // Dynamic import keeps the WASM bundle out of the initial JS chunk
      const { removeBackground } = await import("@imgly/background-removal");

      const resultBlob = await removeBackground(blob, {
        model: "isnet_fp16",
        output: { format: "image/png", quality: 0.9 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        progress: (_key: string, current: number, total: number) => {
          if (total > 0) setAutoProgress(Math.round((current / total) * 100));
        },
      });

      const url = URL.createObjectURL(resultBlob);
      autoObjectUrl.current = url;
      setAutoPreviewUrl(url);
      setAutoStatus("done");
      setAutoProgress(100);
    } catch (err) {
      console.error("[CutoutModal] extraction error:", err);
      setAutoStatus("failed");
    }
  }

  function resetAuto() {
    if (autoObjectUrl.current) {
      URL.revokeObjectURL(autoObjectUrl.current);
      autoObjectUrl.current = null;
    }
    setAutoPreviewUrl(null);
    setAutoStatus("idle");
    setAutoProgress(0);
  }

  // ─── Apply result ──────────────────────────────────────────────────────────

  async function applyAsNewLayer() {
    let url: string | null =
      mode === "auto"  ? autoPreviewUrl :
      mode === "lasso" ? lassoPreviewUrl :
      null;

    if (mode === "brush") {
      url = await getBrushCutoutFullRes();
    }
    if (!url || !sourceLayer || !project) return;

    pushHistory();
    const maxZ     = Math.max(0, ...project.layers.map((l) => l.zIndex));
    const newLayer: PosterLayer = {
      id:       uuidv4(),
      type:     "foregroundCutout",
      label:    `${sourceLayer.label} (cutout)`,
      x:        sourceLayer.x,
      y:        sourceLayer.y,
      width:    sourceLayer.width,
      height:   sourceLayer.height,
      rotation: sourceLayer.rotation,
      opacity:  1,
      visible:  true,
      locked:   false,
      zIndex:   maxZ + 1,
      imageData: { src: url, fit: "contain" },
    };
    addLayer(newLayer);

    const asset: AssetItem = {
      id:           uuidv4(),
      userId:       "local",
      imageUrl:     url,
      fileName:     `${sourceLayer.label}-cutout.png`,
      createdAt:    new Date().toISOString(),
      usageType:    "subject",
      generatedTag: "cutout",
    };
    addAsset(asset);
    onClose();
  }

  const canApply =
    mode === "auto"  ? !!autoPreviewUrl  :
    mode === "lasso" ? !!lassoPreviewUrl :
    hasStrokes;

  // ─── Shared tab button ─────────────────────────────────────────────────────

  function Tab({ id, label }: { id: CutoutMode; label: string }) {
    return (
      <button
        onClick={() => setMode(id)}
        className="flex-1 text-[10px] tracking-wide uppercase py-2.5 transition-colors"
        style={{
          color:        mode === id ? "#e4e4e7" : "#52525b",
          borderBottom: `1px solid ${mode === id ? "rgba(161,161,170,0.55)" : "transparent"}`,
        }}
      >
        {label}
      </button>
    );
  }

  function lassoHint(): string {
    if (lassoPoints.length === 0)  return "Click and drag to draw selection";
    if (isLassoing && lassoSnap)   return "Release to close selection";
    if (isLassoing)                return "Keep dragging…";
    if (lassoPreviewUrl)           return "Cutout ready — apply or clear to retry";
    return "Selection closed";
  }

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(24px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex overflow-hidden rounded-lg"
        style={{
          background:  "rgba(10,10,12,0.98)",
          border:      "1px solid rgba(255,255,255,0.1)",
          boxShadow:   "0 24px 80px rgba(0,0,0,0.9)",
          width:       840,
          maxWidth:    "94vw",
          minHeight:   480,
        }}
      >
        {/* ── Left: canvas / preview ────────────────────────────────────────── */}
        <div
          className="flex-1 relative overflow-hidden flex items-center justify-center"
          style={{ background: CHECKER }}
        >
          {/* Auto mode: show extracted result or source image */}
          {mode === "auto" && (
            (autoPreviewUrl || imageSrc) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={autoPreviewUrl ?? imageSrc}
                alt={autoPreviewUrl ? "extracted subject" : "source image"}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <span className="text-[10px] text-zinc-600 select-none">No image source</span>
            )
          )}

          {/* Extracting overlay */}
          {mode === "auto" && autoStatus === "extracting" && (
            <div
              className="absolute inset-0 flex items-end justify-center pb-6"
              style={{ background: "rgba(0,0,0,0.4)" }}
            >
              <div className="w-48 space-y-2">
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>{autoProgress < 10 ? "Downloading model…" : "Extracting subject…"}</span>
                  <span>{autoProgress}%</span>
                </div>
                <div className="h-0.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-300 rounded-full transition-all duration-200"
                    style={{ width: `${autoProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Lasso mode */}
          {mode === "lasso" && (
            <>
              <canvas
                ref={lassoRef}
                width={CW}
                height={CH}
                className="absolute inset-0 w-full h-full"
                style={{ cursor: "crosshair" }}
                onMouseDown={onLassoDown}
                onMouseMove={onLassoMove}
                onMouseUp={onLassoUp}
                onMouseLeave={() => { if (isLassoing) setIsLassoing(false); }}
              />
              {lassoPreviewUrl && !isLassoing && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={lassoPreviewUrl} alt="lasso cutout" className="max-w-full max-h-full object-contain" />
                </div>
              )}
              <div className="absolute top-2 left-2 text-[9px] text-zinc-500 pointer-events-none select-none">
                {lassoHint()}
              </div>
            </>
          )}

          {/* Brush mode */}
          {mode === "brush" && (
            <div className="relative w-full h-full">
              <canvas
                ref={brushRef}
                width={CW}
                height={CH}
                className="absolute inset-0 w-full h-full"
                style={{ cursor: "none" }}
                onMouseDown={onBrushDown}
                onMouseMove={onBrushMove}
                onMouseUp={onBrushUp}
                onMouseLeave={() => {
                  setIsBrushing(false);
                  setCursorPx(null);
                  if (hasStrokes) exportBrushPreview();
                }}
              />
              {cursorPx && (
                <div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    width:      brushSize,
                    height:     brushSize,
                    left:       cursorPx.x - brushSize / 2,
                    top:        cursorPx.y - brushSize / 2,
                    border:     `1.5px solid ${brushMode === "erase" ? "rgba(239,68,68,0.85)" : "rgba(74,222,128,0.85)"}`,
                    background: brushMode === "erase" ? "rgba(239,68,68,0.07)" : "rgba(74,222,128,0.07)",
                  }}
                />
              )}
              <div className="absolute top-2 left-2 text-[9px] text-zinc-500 pointer-events-none select-none">
                {brushMode === "erase" ? "Paint to erase background" : "Paint to restore"}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: controls ───────────────────────────────────────────────── */}
        <div
          className="w-60 flex-none flex flex-col"
          style={{ borderLeft: "1px solid rgba(255,255,255,0.07)" }}
        >
          {/* Header */}
          <div
            className="flex-none flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-400">Cutout</span>
            <button
              onClick={onClose}
              className="text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex-none flex" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <Tab id="auto"  label="Auto"  />
            <Tab id="lasso" label="Lasso" />
            <Tab id="brush" label="Brush" />
          </div>

          {/* Tab body */}
          <div className="flex-1 overflow-y-auto py-4 px-4 space-y-3">
            {mode === "auto" && (
              <AutoPanel
                status={autoStatus}
                progress={autoProgress}
                onExtract={handleAutoExtract}
                onReset={resetAuto}
              />
            )}

            {mode === "lasso" && (
              <LassoPanel
                hasPoints={lassoPoints.length > 0}
                hasCutout={!!lassoPreviewUrl}
                onClear={clearLasso}
              />
            )}

            {mode === "brush" && (
              <BrushPanel
                brushMode={brushMode}
                setBrushMode={setBrushMode}
                brushSize={brushSize}
                setBrushSize={setBrushSize}
                hasStrokes={hasStrokes}
                onReset={resetBrush}
              />
            )}
          </div>

          {/* Footer */}
          <div
            className="flex-none px-4 py-3 flex flex-col gap-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
          >
            {canApply && (
              <div className="text-[9px] text-green-400/70 text-center">Cutout ready</div>
            )}
            <button
              onClick={applyAsNewLayer}
              disabled={!canApply}
              className="w-full text-[10px] tracking-wide uppercase py-2 transition-all disabled:opacity-25"
              style={{
                background: canApply ? "rgba(255,255,255,0.1)"  : "rgba(255,255,255,0.03)",
                border:     `1px solid ${canApply ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.07)"}`,
                color:      canApply ? "#e4e4e7" : "#52525b",
              }}
            >
              Apply as New Layer
            </button>
            <button
              onClick={onClose}
              className="w-full border border-zinc-800 hover:border-zinc-600 text-[10px] tracking-wide uppercase text-zinc-600 hover:text-zinc-300 py-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Auto panel ───────────────────────────────────────────────────────────────

function AutoPanel({
  status,
  progress,
  onExtract,
  onReset,
}: {
  status: AutoStatus;
  progress: number;
  onExtract: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3">
      {status === "idle" && (
        <>
          <p className="text-[9px] text-zinc-500 leading-relaxed">
            AI-powered extraction runs locally in your browser — no API key needed, handles hair and complex edges.
          </p>
          <p className="text-[9px] text-zinc-600 leading-relaxed">
            First run downloads the model (~40 MB) and caches it. Subsequent runs are fast.
          </p>
          <button
            onClick={onExtract}
            className="w-full border border-zinc-700 hover:border-zinc-400 text-zinc-300 hover:text-zinc-100 text-[10px] tracking-wide uppercase py-2 transition-colors"
          >
            Extract Subject
          </button>
        </>
      )}

      {status === "extracting" && (
        <div className="space-y-3">
          <p className="text-[9px] text-zinc-400 leading-relaxed">
            {progress < 10
              ? "Downloading AI model (~40 MB, cached after first use)…"
              : "Removing background…"}
          </p>
          <div className="space-y-1.5">
            <div className="flex justify-between font-mono text-[9px] text-zinc-500">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-0.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-zinc-400 rounded-full transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {status === "done" && (
        <>
          <p className="text-[9px] text-green-400/80 leading-relaxed">
            Subject extracted. Click Apply to add as a new layer.
          </p>
          <button
            onClick={onReset}
            className="w-full border border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-zinc-200 text-[10px] tracking-wide uppercase py-1.5 transition-colors"
          >
            Try Again
          </button>
        </>
      )}

      {status === "failed" && (
        <>
          <p className="text-[9px] text-red-400/80 leading-relaxed">
            Extraction failed. Check the console for details, or use Lasso for manual selection.
          </p>
          <button
            onClick={onExtract}
            className="w-full border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-100 text-[10px] tracking-wide uppercase py-2 transition-colors"
          >
            Retry
          </button>
        </>
      )}
    </div>
  );
}

// ─── Lasso panel ──────────────────────────────────────────────────────────────

function LassoPanel({
  hasPoints,
  hasCutout,
  onClear,
}: {
  hasPoints: boolean;
  hasCutout: boolean;
  onClear: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[9px] text-zinc-500 leading-relaxed">
        Click and drag over the subject to draw a freeform selection.
        Release near the start point to snap-close, or release anywhere to auto-close.
      </p>

      {(hasPoints || hasCutout) && (
        <button
          onClick={onClear}
          className="w-full border border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-zinc-200 text-[10px] tracking-wide uppercase py-1.5 transition-colors"
        >
          Clear Selection
        </button>
      )}

      <div
        className="space-y-1 text-[9px] text-zinc-600 leading-relaxed"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 10 }}
      >
        <div>· Drag to draw path</div>
        <div>· Release to close selection</div>
        <div>· Blue dot = snap to start</div>
        <div>· Clear to start over</div>
      </div>
    </div>
  );
}

// ─── Brush panel ──────────────────────────────────────────────────────────────

function BrushPanel({
  brushMode,
  setBrushMode,
  brushSize,
  setBrushSize,
  hasStrokes,
  onReset,
}: {
  brushMode: "erase" | "restore";
  setBrushMode: (m: "erase" | "restore") => void;
  brushSize: number;
  setBrushSize: (s: number) => void;
  hasStrokes: boolean;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {(["erase", "restore"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setBrushMode(m)}
            className="flex-1 py-1.5 text-[10px] uppercase transition-colors"
            style={{
              border: `1px solid ${brushMode === m ? "rgba(161,161,170,0.5)" : "rgba(255,255,255,0.08)"}`,
              color:  brushMode === m ? "#e4e4e7" : "#52525b",
            }}
          >
            {m}
          </button>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase text-zinc-500">Size</span>
          <span className="font-mono text-[10px] text-zinc-500">{brushSize}px</span>
        </div>
        <input
          type="range"
          min={4}
          max={100}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-full h-0.5 accent-zinc-400"
        />
      </div>

      {hasStrokes && (
        <button
          onClick={onReset}
          className="w-full border border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-zinc-200 text-[10px] tracking-wide uppercase py-1.5 transition-colors"
        >
          Reset
        </button>
      )}

      <div
        className="space-y-1 text-[9px] text-zinc-600 leading-relaxed"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 10 }}
      >
        <div>· Erase: paint to remove background</div>
        <div>· Restore: paint to bring back areas</div>
        <div>· Reset clears all brush strokes</div>
      </div>
    </div>
  );
}
