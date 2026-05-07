# Poster Agent — AI-Powered Poster Design Studio

A layer-based poster editor where AI creates the initial design and you control every element. Build personalized film and exhibition posters with full manual override.

## Features

- **Google Authentication** — sign in with Google, all projects are saved to your account
- **AI Layout Generation** — Claude generates a complete structured poster layout (not a flat image) as editable layers
- **Layer-Based Editor** — built with React-Konva; every element is a draggable, resizable, rotatable layer
- **Full Layer Controls** — lock, hide, duplicate, delete, reorder, change opacity, rotate, resize
- **Text Editing** — change font, size, color, style, letter-spacing, alignment inline
- **Image Input Modes** — upload as background, crop to fit, extract subject (transparent cutout), or style reference only
- **Text-Behind-Subject Effect** — foreground cutout layer sits above text, above background — enabling the cinematic text-behind-subject look
- **AI Edit Buttons** — Regenerate All, New Image Only, Improve Typography, Improve Layout, Create Variation (respects locked layers)
- **AI Copy Mode** — toggle "AI Write Copy" to let Claude generate title/subtitle/credits, or provide your own
- **PNG Export** — export the full-resolution poster
- **Project Saving** — projects saved as JSON with full layer state, prompt history, and locked layer tracking

## Tech Stack

- **Next.js 16** (App Router)
- **React-Konva** for the canvas editor
- **NextAuth v5** with Google provider
- **Prisma v7** + SQLite (via libsql adapter)
- **Zustand** + Immer for editor state
- **Claude (Anthropic API)** for layout and typography generation
- **Replicate** (optional) for AI image generation
- **Remove.bg** (optional) for subject extraction

## Setup

### 1. Clone and install

```bash
git clone https://github.com/NianhanGuo/poster-agent.git
cd poster-agent
npm install
```

### 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in your keys:

```bash
cp .env.local .env.local
```

Required:
- `NEXTAUTH_SECRET` — any random string (run `openssl rand -base64 32`)
- `NEXTAUTH_URL` — `http://localhost:3000` for local dev
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — from [Google Cloud Console](https://console.cloud.google.com) (OAuth 2.0)
- `ANTHROPIC_API_KEY` — from [Anthropic Console](https://console.anthropic.com)

Optional (for AI image generation):
- `REPLICATE_API_TOKEN` — from [Replicate](https://replicate.com)
- `REMOVE_BG_API_KEY` — from [Remove.bg](https://remove.bg/api)

### 3. Database

```bash
npx prisma migrate dev
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

1. **Sign in** with Google
2. **Create a new poster** — choose type (film/exhibition), canvas size, language, style preset, and prompt
3. **One-click generate** — Claude generates a structured JSON layout with text layers and an image prompt; if Replicate is configured, the background image is generated too
4. **Edit in the canvas** — drag layers, resize, rotate, edit text inline, change fonts/colors
5. **Use the layer panel** — reorder, lock, hide, duplicate, or delete any layer
6. **AI edit buttons** — iterate: regenerate the whole design, just the image, just the typography, or create a variation; locked layers are always preserved
7. **Upload images** — drop an image and choose how to use it: as background, crop to fit, extract the subject, or style reference
8. **Export** — click "Export PNG" on the canvas for the full-resolution output

## Project JSON Schema

Projects are stored as JSON with this shape:

```json
{
  "id": "cuid",
  "userId": "cuid",
  "title": "Elysium",
  "canvas": { "size": "a4", "width": 794, "height": 1123 },
  "layers": [
    {
      "id": "uuid",
      "type": "background-image | title-text | subtitle-text | date-location-text | credits-text | foreground-cutout | user-text | user-image",
      "label": "Background",
      "x": 0, "y": 0, "width": 794, "height": 1123,
      "rotation": 0, "opacity": 1,
      "visible": true, "locked": false, "zIndex": 1,
      "imageData": { "src": "/uploads/...", "fit": "fill" },
      "textData": { "text": "ELYSIUM", "fontSize": 120, "fontFamily": "Helvetica", "fontStyle": "bold", "fill": "#ffffff", "align": "center" }
    }
  ],
  "stylePreset": "cinematic",
  "posterType": "film",
  "language": "english",
  "promptHistory": ["A noir thriller in 1940s Shanghai"],
  "lockedLayers": []
}
```
