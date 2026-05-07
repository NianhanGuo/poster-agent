# Poster Agent

A layer-based AI poster design studio for film and exhibition posters. AI generates the initial layout and background image; you have full control over every element in a Procreate-style canvas editor.

![Demo mode — no API key required](https://img.shields.io/badge/demo%20mode-no%20API%20key%20required-green)

## Features

### AI Generation
- **Layout generation** — GPT-4o builds a complete structured layer layout (positions, typography, hierarchy) from a natural-language concept
- **Image generation** — DALL-E 3 generates the background with intentional negative space for overlaid typography
- **Reference images** — upload reference images at the setup screen; extracted color palettes and style targets flow into both the layout and image prompts
- **AI refinement** — natural language commands in the editor toolbar to regenerate, swap image, improve typography, or create a variation; locked layers are always preserved
- **Generate from Reference** — dedicated Reference panel generates new background variations from an uploaded reference image, adding results directly to the Asset Library

### 8 Style Presets
| Preset | Character |
|---|---|
| Cinematic Rain | Dark atmosphere, dramatic light, film grain |
| Gallery Minimal | White space is the statement |
| Brutalist Wall | Raw force, maximum contrast |
| Soft Editorial | Restrained warmth, literary tone |
| Surreal Film | Between waking and dream |
| Archive Museum | Institutional, authoritative |
| Experimental Type | Typography is the image |
| **Blur Field** | Soft light, airy geometry, gallery calm |

### Canvas Editor
- **React-Konva canvas** — every layer is draggable, resizable, and rotatable via transform handles
- **Text layers** — full rotation support via Konva Transformer; double-click to edit inline
- **Image layers** — PNG transparency preserved; background, subject, user image, and drawing layer types
- **Brush drawing** — freehand paint overlay stored as a raster PNG layer; configurable color, size, and opacity
- **Drag-and-drop layer reordering** — `@dnd-kit` sortable list with ⠿ handle; zIndex normalised on drop
- **Full undo / redo** — every drag, resize, rotate, text edit, and brush stroke is undoable

### Inspector (right panel)
- Font picker with Google Fonts, weight slider, italic toggle
- Color swatches, hex input, and color picker
- Gradient fills (linear presets)
- Effects: shadow, neon glow, outline, underline, strikethrough, with per-effect controls
- **Rotation controls** — slider, editable numeric input, quick-angle buttons (0° / 90° / −90°), and reset
- Opacity, X/Y/W/H numeric inputs, zIndex override

### Layer Panel (left sidebar)
- Layer visibility toggle, lock toggle, duplicate, delete
- Move up / move down buttons
- Drag-to-reorder with visual ghost preview
- Add text, image, or drawing layer from footer

### Asset Library
- Upload images via drag-and-drop or file picker
- Apply assets as: Add Layer, Set Background, Foreground, or Reference
- AI-generated assets tagged with an "AI" badge
- Temporary local storage (sign in to persist permanently)

### Canvas Sizes
`A4` · `A3` · `Square (1080×1080)` · `Story (1080×1920)` · `Custom`

### Export
- **PNG Export** — full-resolution canvas output (2× pixel ratio); drawing layers and rotated text included

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Canvas | React-Konva + Konva |
| AI — layout & type | OpenAI GPT-4o (`gpt-4o`) |
| AI — images | OpenAI DALL-E 3 |
| State | Zustand + Immer |
| Drag-and-drop | @dnd-kit/core + @dnd-kit/sortable |
| Auth (optional) | NextAuth.js |
| Styling | Tailwind CSS v4 |

---

## Quick Start

```bash
git clone https://github.com/NianhanGuo/poster-agent.git
cd poster-agent
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app runs in **demo mode** with no API keys — mock layouts and SVG gradient placeholders are used instead of calling OpenAI.

---

## Environment Variables

Create `.env.local` in the project root:

```bash
# Required for AI generation (layout, image, typography, brief)
OPENAI_API_KEY=sk-...

# Optional — background removal for subject/cutout layers
REMOVE_BG_API_KEY=...

# Optional — NextAuth (only needed if you add sign-in)
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

---

## Deployment (Vercel)

1. Push to GitHub
2. Import the repo at [vercel.com](https://vercel.com)
3. Add `OPENAI_API_KEY` in **Project → Settings → Environment Variables**
4. Deploy — no database or additional setup required

---

## How It Works

```
Setup screen
  └─ Choose: poster type · canvas size · style preset · concept prompt
  └─ Optionally: upload reference images, set influence targets

Generate
  └─ /api/generate/brief  → GPT-4o produces a DesignBrief (mood, composition, color strategy…)
  └─ /api/generate/layout → GPT-4o returns a JSON layer array with text and image layers
  └─ /api/generate/image  → DALL-E 3 generates the background; baked into the backgroundImage layer

Edit
  └─ Drag / resize / rotate layers on the canvas
  └─ Select a layer → inspector shows text or image controls
  └─ Reorder layers by dragging the ⠿ handle in the Layer Panel
  └─ Paint with the brush tool → strokes accumulate in a drawingLayer
  └─ Undo / redo any action with Ctrl+Z / Ctrl+Shift+Z (or QuickPanel buttons)

Refine
  └─ AI toolbar: Regenerate · Image · Typography · Variation
  └─ Lock layers to preserve them across regenerations
  └─ Reference panel: upload image → Generate from Reference → apply to canvas or Asset Library

Export
  └─ Click "Export PNG" on the canvas for full-resolution output
```

---

## Demo Mode

When `OPENAI_API_KEY` is not set, every API route falls back gracefully:

| Route | Demo behaviour |
|---|---|
| `/api/generate/brief` | Returns a hard-coded `DesignBrief` per style preset |
| `/api/generate/layout` | Returns a hand-crafted layer layout per style preset |
| `/api/generate/image` | Returns an SVG gradient / blurred-circle image matching the preset palette |
| `/api/generate/typography` | No-ops; existing layers unchanged |

The full editor — drag, resize, rotate, text edit, brush drawing, upload, export — works in demo mode.

---

## Layer Schema

```json
{
  "id": "uuid",
  "type": "backgroundImage | subjectImage | titleText | subtitleText | metaText | bodyText | foregroundCutout | userText | userImage | drawingLayer",
  "label": "Title",
  "x": 40, "y": 700,
  "width": 714, "height": 120,
  "rotation": -8,
  "opacity": 1,
  "visible": true,
  "locked": false,
  "zIndex": 4,
  "textData": {
    "text": "MEMORIA",
    "fontSize": 120,
    "fontFamily": "Impact",
    "fontStyle": "normal",
    "fill": "#ffffff",
    "align": "center",
    "letterSpacing": 14,
    "lineHeight": 1.1,
    "shadowEnabled": false,
    "effects": []
  }
}
```

Image layers use `imageData: { src: "data:image/png;base64,…", fit: "fill" | "contain" | "cover" }` instead of `textData`.
