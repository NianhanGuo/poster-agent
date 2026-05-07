export interface PaletteColor {
  hex: string;
  role: "dominant" | "accent" | "shadow" | "highlight";
}

function toHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function colorDist(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/**
 * Samples the image at 150×150, quantizes into colour buckets, picks 5–8
 * perceptually distinct colours and assigns roles based on frequency and
 * brightness. Runs entirely in the browser via Canvas API.
 */
export function extractPaletteFromUrl(imageUrl: string): Promise<PaletteColor[]> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const SIZE = 150;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve([]); return; }

        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

        // Accumulate pixel averages per quantised bucket (bucket size = 24 per channel)
        const BUCKET = 24;
        type Entry = { rSum: number; gSum: number; bSum: number; count: number };
        const freq = new Map<string, Entry>();

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue; // skip transparent pixels
          const qr = Math.round(data[i]     / BUCKET) * BUCKET;
          const qg = Math.round(data[i + 1] / BUCKET) * BUCKET;
          const qb = Math.round(data[i + 2] / BUCKET) * BUCKET;
          const key = `${qr},${qg},${qb}`;
          const e = freq.get(key);
          if (e) {
            e.rSum += data[i]; e.gSum += data[i + 1]; e.bSum += data[i + 2]; e.count++;
          } else {
            freq.set(key, { rSum: data[i], gSum: data[i + 1], bSum: data[i + 2], count: 1 });
          }
        }

        // Sort by pixel frequency (most common colour first)
        const sorted = [...freq.values()]
          .map(e => ({
            r: Math.round(e.rSum / e.count),
            g: Math.round(e.gSum / e.count),
            b: Math.round(e.bSum / e.count),
            count: e.count,
          }))
          .sort((a, b) => b.count - a.count);

        // Greedily select colours that are perceptually distinct (min distance 50)
        const MIN_DIST = 50;
        const selected: typeof sorted = [];
        for (const c of sorted) {
          if (selected.length >= 8) break;
          const distinct = selected.every(s =>
            colorDist(c.r, c.g, c.b, s.r, s.g, s.b) > MIN_DIST
          );
          if (!distinct && selected.length > 0) continue;
          selected.push(c);
        }

        const palette: PaletteColor[] = selected.map(({ r, g, b }, i) => {
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          let role: PaletteColor["role"];
          if (i === 0)             role = "dominant";
          else if (brightness > 200) role = "highlight";
          else if (brightness < 60)  role = "shadow";
          else                       role = "accent";
          return { hex: toHex(r, g, b), role };
        });

        resolve(palette);
      } catch {
        resolve([]);
      }
    };
    img.onerror = () => resolve([]);
    img.src = imageUrl;
  });
}

/**
 * Builds the colour-palette section of a generation prompt.
 * strength 0–30  → loose inspiration
 * strength 31–70 → noticeable influence
 * strength 71–100 → strict, dominant constraint
 */
export function buildPalettePrompt(
  palette: PaletteColor[],
  strength: number,
  colorTargetActive: boolean,
): string {
  if (!colorTargetActive || palette.length === 0) return "";

  const swatches = palette
    .map(p => `${p.hex}(${p.role})`)
    .join(", ");

  const dominant = palette[0]?.hex ?? "#000000";
  const accents  = palette.slice(1).map(p => p.hex).join(", ");

  if (strength >= 71) {
    return `
STRICT COLOR PALETTE — strength ${strength}/100 — MANDATORY:
Extracted palette: ${swatches}
Rules:
- The dominant color ${dominant} must fill the majority of the background and set the primary atmosphere.
- Accent colors (${accents || "none"}) appear in lighting, highlights, and key elements.
- Do NOT introduce colors outside this palette as primary elements.
- Apply this palette to color grading, ambient light, and material colors.
- Do NOT copy composition, framing, or subject matter from the reference. COLOR ONLY.`;
  }

  if (strength >= 31) {
    return `
COLOR PALETTE GUIDANCE — strength ${strength}/100:
Reference palette: ${swatches}
Let these colors define the overall mood, lighting atmosphere, and material tones.
The dominant color ${dominant} should be the primary visual tone.
Do NOT copy composition or subject matter from reference — color influence only.`;
  }

  return `
COLOR INSPIRATION (loose) — strength ${strength}/100:
Loosely draw from: ${swatches}`;
}
