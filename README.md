# Poster Agent

A layer-based AI poster design studio for film and exhibition posters. Built for designers who want full control — AI generates the initial layout and image, you edit every element.

## Features

- **AI Layout Generation** — GPT-4o generates a complete structured poster layout as editable layers (positions, typography, hierarchy)
- **AI Image Generation** — DALL-E 3 generates the background image with intentional negative space for typography
- **7 Style Recipes** — Cinematic Rain, Gallery Minimal, Brutalist Wall, Soft Editorial, Surreal Film, Archive Museum, Experimental Type
- **Layer-Based Editor** — React-Konva canvas; every element is draggable, resizable, and rotatable
- **Full Layer Controls** — lock, hide, duplicate, delete, reorder, change opacity
- **Text Editing** — font, size, color, style, letter-spacing, alignment
- **Image Upload** — background, crop-to-fit, subject extraction, or as-is
- **AI Refinement Bar** — natural language commands + one-click Regenerate / Image / Type / Variation
- **PNG Export** — full-resolution canvas export
- **Demo Mode** — runs with zero environment variables (mock layouts + gradient placeholders)

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **React-Konva** — canvas editor
- **OpenAI** — GPT-4o for layout + typography, DALL-E 3 for images
- **Zustand** + Immer — editor state
- **Remove.bg** (optional) — subject background removal

## Quick Start

```bash
git clone https://github.com/NianhanGuo/poster-agent.git
cd poster-agent
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app runs in demo mode with no API keys.

## Environment Variables

Create `.env.local`:

```bash
# Required for AI features
OPENAI_API_KEY=sk-...

# Optional — for subject background removal
REMOVE_BG_API_KEY=...
```

### Vercel Deployment

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add `OPENAI_API_KEY` in **Project → Settings → Environment Variables**
4. Deploy

No database or auth setup required.

## How It Works

1. **Compose** — choose poster type (film / exhibition), canvas size, style recipe, and describe the concept
2. **Generate** — GPT-4o builds a structured JSON layout; DALL-E 3 generates the background image
3. **Edit** — drag layers, resize, rotate, edit text, change fonts and colors in the inspector
4. **Refine** — use the AI bar to regenerate, swap the image, improve typography, or create a variation; locked layers are always preserved
5. **Export** — Export PNG for full-resolution output

## Demo Mode

When `OPENAI_API_KEY` is not set:
- `/api/generate/layout` returns a mock layout (one per style recipe)
- `/api/generate/image` returns an SVG gradient matching the recipe's color palette
- The editor is fully usable — drag, resize, edit text, upload images, export

## Layer Schema

```json
{
  "id": "uuid",
  "type": "backgroundImage | titleText | subtitleText | metaText | bodyText | foregroundCutout | userText | userImage",
  "label": "Title",
  "x": 40, "y": 700, "width": 714, "height": 120,
  "rotation": 0, "opacity": 1, "visible": true, "locked": false, "zIndex": 4,
  "textData": {
    "text": "MEMORIA",
    "fontSize": 120,
    "fontFamily": "Impact",
    "fontStyle": "normal",
    "fill": "#ffffff",
    "align": "center",
    "letterSpacing": 14,
    "lineHeight": 1.1
  }
}
```
