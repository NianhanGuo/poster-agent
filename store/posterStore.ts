import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { v4 as uuidv4 } from "uuid";
import type {
  PosterLayer,
  PosterProject,
  TextLayerData,
  ImageLayerData,
  ReferenceConfig,
  ReferenceImage,
  AssetItem,
  DesignBrief,
  ProjectVersion,
  CanvasConfig,
} from "@/types/poster";
import type { PaletteColor } from "@/lib/colorExtract";
import { DEFAULT_REFERENCE } from "@/types/poster";

interface PosterState {
  project: PosterProject | null;
  selectedLayerId: string | null;
  isGenerating: boolean;
  generatingStep: string;
  history: PosterLayer[][];
  historyIndex: number;

  // Design metadata from AI
  designRationale: string | null;
  generatedPalette: { dominant: string; secondary: string; accent: string; background: string } | null;
  setDesignRationale: (r: string | null) => void;
  setGeneratedPalette: (p: { dominant: string; secondary: string; accent: string; background: string } | null) => void;

  // Project actions
  setProject: (project: PosterProject) => void;
  clearProject: () => void;

  // Layer selection
  selectLayer: (id: string | null) => void;

  // Layer mutations
  addLayer: (layer: PosterLayer) => void;
  removeLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<PosterLayer>) => void;
  updateTextData: (id: string, updates: Partial<TextLayerData>) => void;
  updateImageData: (id: string, updates: Partial<ImageLayerData>) => void;
  moveLayerUp: (id: string) => void;
  moveLayerDown: (id: string) => void;
  toggleLock: (id: string) => void;
  toggleVisibility: (id: string) => void;
  reorderLayers: (layers: PosterLayer[]) => void;

  // AI state
  setGenerating: (generating: boolean, step?: string) => void;
  // Design director
  designBrief: DesignBrief | null;
  setDesignBrief: (brief: DesignBrief | null) => void;

  // Version history
  projectVersions: ProjectVersion[];
  currentVersionIndex: number;
  pushVersion: (project: PosterProject, brief?: DesignBrief) => void;
  restoreVersion: (index: number) => void;

  // Canvas
  resizeCanvas: (newCanvas: CanvasConfig) => void;

  // Reference image
  reference: ReferenceConfig;
  setReference: (updates: Partial<ReferenceConfig>) => void;
  setReferenceImage: (url: string | null) => void;
  setReferencePalette: (palette: PaletteColor[], error?: string) => void;
  // Multi-reference
  addReferenceImage: (image: ReferenceImage) => void;
  removeReferenceImage: (id: string) => void;
  updateReferenceImage: (id: string, updates: Partial<ReferenceImage>) => void;

  // Asset library
  assets: AssetItem[];
  addAsset: (asset: AssetItem) => void;
  removeAsset: (id: string) => void;

  // History
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Brush tool
  brushActive: boolean;
  brushColor: string;
  brushSize: number;
  brushOpacity: number;
  setBrushActive: (active: boolean) => void;
  setBrushColor: (color: string) => void;
  setBrushSize: (size: number) => void;
  setBrushOpacity: (opacity: number) => void;

  // Derived
  getLayerById: (id: string) => PosterLayer | undefined;
  getSortedLayers: () => PosterLayer[];
}

const MAX_HISTORY = 30;

export const usePosterStore = create<PosterState>()(
  immer((set, get) => ({
    project: null,
    selectedLayerId: null,
    isGenerating: false,
    generatingStep: "",
    history: [],
    historyIndex: -1,
    designBrief: null,
    designRationale: null,
    generatedPalette: null,
    projectVersions: [],
    currentVersionIndex: -1,
    reference: { ...DEFAULT_REFERENCE },
    assets: [],
    brushActive: false,
    brushColor: "#ffffff",
    brushSize: 8,
    brushOpacity: 0.9,

    setProject: (project) =>
      set((state) => {
        state.project = project;
        state.selectedLayerId = null;
        state.history = [];
        state.historyIndex = -1;
      }),

    clearProject: () =>
      set((state) => {
        state.project = null;
        state.selectedLayerId = null;
        state.projectVersions = [];
        state.currentVersionIndex = -1;
        state.designBrief = null;
        state.designRationale = null;
        state.generatedPalette = null;
      }),

    setDesignRationale: (r) =>
      set((state) => {
        state.designRationale = r;
      }),

    setGeneratedPalette: (p) =>
      set((state) => {
        state.generatedPalette = p;
      }),

    selectLayer: (id) =>
      set((state) => {
        state.selectedLayerId = id;
      }),

    addLayer: (layer) =>
      set((state) => {
        if (!state.project) return;
        get().pushHistory();
        if (layer.zIndex == null) {
          const maxZ = Math.max(0, ...state.project.layers.map((l) => l.zIndex));
          layer.zIndex = maxZ + 1;
        }
        state.project.layers.push(layer);
        state.selectedLayerId = layer.id;
      }),

    removeLayer: (id) =>
      set((state) => {
        if (!state.project) return;
        get().pushHistory();
        state.project.layers = state.project.layers.filter((l) => l.id !== id);
        if (state.selectedLayerId === id) state.selectedLayerId = null;
      }),

    duplicateLayer: (id) =>
      set((state) => {
        if (!state.project) return;
        const layer = state.project.layers.find((l) => l.id === id);
        if (!layer) return;
        get().pushHistory();
        const maxZ = Math.max(0, ...state.project.layers.map((l) => l.zIndex));
        const clone: PosterLayer = {
          ...JSON.parse(JSON.stringify(layer)),
          id: uuidv4(),
          x: layer.x + 20,
          y: layer.y + 20,
          zIndex: maxZ + 1,
          label: `${layer.label} (copy)`,
        };
        state.project.layers.push(clone);
        state.selectedLayerId = clone.id;
      }),

    updateLayer: (id, updates) =>
      set((state) => {
        if (!state.project) return;
        const layer = state.project.layers.find((l) => l.id === id);
        if (layer) Object.assign(layer, updates);
      }),

    updateTextData: (id, updates) =>
      set((state) => {
        if (!state.project) return;
        const layer = state.project.layers.find((l) => l.id === id);
        if (layer && layer.textData) Object.assign(layer.textData, updates);
      }),

    updateImageData: (id, updates) =>
      set((state) => {
        if (!state.project) return;
        const layer = state.project.layers.find((l) => l.id === id);
        if (layer && layer.imageData) Object.assign(layer.imageData, updates);
      }),

    moveLayerUp: (id) =>
      set((state) => {
        if (!state.project) return;
        get().pushHistory();
        const layer = state.project.layers.find((l) => l.id === id);
        if (!layer) return;
        const sorted = [...state.project.layers].sort(
          (a, b) => a.zIndex - b.zIndex
        );
        const idx = sorted.findIndex((l) => l.id === id);
        if (idx < sorted.length - 1) {
          const upper = sorted[idx + 1];
          const tmp = layer.zIndex;
          layer.zIndex = upper.zIndex;
          const upperLayer = state.project.layers.find(
            (l) => l.id === upper.id
          );
          if (upperLayer) upperLayer.zIndex = tmp;
        }
      }),

    moveLayerDown: (id) =>
      set((state) => {
        if (!state.project) return;
        get().pushHistory();
        const layer = state.project.layers.find((l) => l.id === id);
        if (!layer) return;
        const sorted = [...state.project.layers].sort(
          (a, b) => a.zIndex - b.zIndex
        );
        const idx = sorted.findIndex((l) => l.id === id);
        if (idx > 0) {
          const lower = sorted[idx - 1];
          const tmp = layer.zIndex;
          layer.zIndex = lower.zIndex;
          const lowerLayer = state.project.layers.find(
            (l) => l.id === lower.id
          );
          if (lowerLayer) lowerLayer.zIndex = tmp;
        }
      }),

    toggleLock: (id) =>
      set((state) => {
        if (!state.project) return;
        const layer = state.project.layers.find((l) => l.id === id);
        if (layer) layer.locked = !layer.locked;
      }),

    toggleVisibility: (id) =>
      set((state) => {
        if (!state.project) return;
        const layer = state.project.layers.find((l) => l.id === id);
        if (layer) layer.visible = !layer.visible;
      }),

    reorderLayers: (layers) =>
      set((state) => {
        if (!state.project) return;
        state.project.layers = layers;
      }),

    setGenerating: (generating, step = "") =>
      set((state) => {
        state.isGenerating = generating;
        state.generatingStep = step;
      }),

    setDesignBrief: (brief) =>
      set((state) => {
        state.designBrief = brief;
      }),

    pushVersion: (project, brief) =>
      set((state) => {
        const MAX_VERSIONS = 5;
        const version: ProjectVersion = {
          project: JSON.parse(JSON.stringify(project)),
          brief,
          timestamp: new Date().toISOString(),
        };
        state.projectVersions.push(version);
        if (state.projectVersions.length > MAX_VERSIONS) {
          state.projectVersions.shift();
        }
        state.currentVersionIndex = state.projectVersions.length - 1;
      }),

    restoreVersion: (index) =>
      set((state) => {
        const version = state.projectVersions[index];
        if (!version) return;
        state.project = JSON.parse(JSON.stringify(version.project));
        state.designBrief = version.brief ?? null;
        state.currentVersionIndex = index;
      }),

    resizeCanvas: (newCanvas) =>
      set((state) => {
        if (!state.project) return;
        const oldW = state.project.canvas.width;
        const oldH = state.project.canvas.height;
        const sx = newCanvas.width / oldW;
        const sy = newCanvas.height / oldH;
        state.project.canvas = newCanvas;
        state.project.layers = state.project.layers.map((l) => ({
          ...l,
          x: Math.round(l.x * sx),
          y: Math.round(l.y * sy),
          width: Math.round(l.width * sx),
          height: Math.round(l.height * sy),
        }));
      }),

    setReference: (updates) =>
      set((state) => {
        Object.assign(state.reference, updates);
      }),

    setReferenceImage: (url) =>
      set((state) => {
        state.reference.imageUrl = url;
        if (!url) {
          state.reference.palette = [];
          state.reference.paletteError = "";
        }
      }),

    setReferencePalette: (palette, error = "") =>
      set((state) => {
        state.reference.palette = palette;
        state.reference.paletteError = error;
      }),

    addReferenceImage: (image) =>
      set((state) => {
        if (!Array.isArray(state.reference.images)) state.reference.images = [];
        state.reference.images.push(image);
      }),

    removeReferenceImage: (id) =>
      set((state) => {
        if (!Array.isArray(state.reference.images)) { state.reference.images = []; return; }
        state.reference.images = state.reference.images.filter((img) => img.id !== id);
      }),

    updateReferenceImage: (id, updates) =>
      set((state) => {
        if (!Array.isArray(state.reference.images)) return;
        const img = state.reference.images.find((i) => i.id === id);
        if (img) Object.assign(img, updates);
      }),

    setBrushActive: (active) => set((state) => { state.brushActive = active; }),
    setBrushColor: (color) => set((state) => { state.brushColor = color; }),
    setBrushSize: (size) => set((state) => { state.brushSize = size; }),
    setBrushOpacity: (opacity) => set((state) => { state.brushOpacity = opacity; }),

    addAsset: (asset) =>
      set((state) => {
        state.assets.push(asset);
      }),

    removeAsset: (id) =>
      set((state) => {
        state.assets = state.assets.filter((a) => a.id !== id);
      }),

    pushHistory: () => {
      const { project, history, historyIndex } = get();
      if (!project) return;
      const snapshot = JSON.parse(JSON.stringify(project.layers));
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(snapshot);
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      set((state) => {
        state.history = newHistory;
        state.historyIndex = newHistory.length - 1;
      });
    },

    undo: () =>
      set((state) => {
        if (!state.project || state.historyIndex <= 0) return;
        state.historyIndex -= 1;
        state.project.layers = JSON.parse(
          JSON.stringify(state.history[state.historyIndex])
        );
      }),

    redo: () =>
      set((state) => {
        if (!state.project || state.historyIndex >= state.history.length - 1)
          return;
        state.historyIndex += 1;
        state.project.layers = JSON.parse(
          JSON.stringify(state.history[state.historyIndex])
        );
      }),

    getLayerById: (id) => get().project?.layers.find((l) => l.id === id),

    getSortedLayers: () => {
      const layers = get().project?.layers ?? [];
      return [...layers].sort((a, b) => a.zIndex - b.zIndex);
    },
  }))
);
