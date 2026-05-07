import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { v4 as uuidv4 } from "uuid";
import type {
  Layer,
  CanvasConfig,
  PosterProject,
  StylePreset,
  PosterType,
  Language,
  TextLayerData,
  ImageLayerData,
} from "@/types/poster";

interface PosterState {
  project: PosterProject | null;
  selectedLayerId: string | null;
  isGenerating: boolean;
  isSaving: boolean;
  generatingStep: string;
  history: Layer[][];
  historyIndex: number;

  // Project actions
  setProject: (project: PosterProject) => void;
  clearProject: () => void;

  // Layer selection
  selectLayer: (id: string | null) => void;

  // Layer mutations
  addLayer: (layer: Layer) => void;
  removeLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  updateTextData: (id: string, updates: Partial<TextLayerData>) => void;
  updateImageData: (id: string, updates: Partial<ImageLayerData>) => void;
  moveLayerUp: (id: string) => void;
  moveLayerDown: (id: string) => void;
  toggleLock: (id: string) => void;
  toggleVisibility: (id: string) => void;
  reorderLayers: (layers: Layer[]) => void;

  // AI state
  setGenerating: (generating: boolean, step?: string) => void;
  setSaving: (saving: boolean) => void;

  // History
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Derived
  getLayerById: (id: string) => Layer | undefined;
  getSortedLayers: () => Layer[];
}

const MAX_HISTORY = 30;

export const usePosterStore = create<PosterState>()(
  immer((set, get) => ({
    project: null,
    selectedLayerId: null,
    isGenerating: false,
    isSaving: false,
    generatingStep: "",
    history: [],
    historyIndex: -1,

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
      }),

    selectLayer: (id) =>
      set((state) => {
        state.selectedLayerId = id;
      }),

    addLayer: (layer) =>
      set((state) => {
        if (!state.project) return;
        get().pushHistory();
        const maxZ = Math.max(0, ...state.project.layers.map((l) => l.zIndex));
        layer.zIndex = maxZ + 1;
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
        const clone: Layer = {
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

    setSaving: (saving) =>
      set((state) => {
        state.isSaving = saving;
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
