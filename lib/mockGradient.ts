import type { StyleRecipe } from "@/types/poster";
import { RECIPES } from "@/lib/styleRecipes";

export function mockGradientDataUrl(
  recipe: StyleRecipe | string,
  width: number,
  height: number,
): string {
  const def = RECIPES[recipe as StyleRecipe] ?? RECIPES["cinematic-rain"];
  const { bg, surface } = def.palette;

  // Blur Field gets its own layered-circles SVG
  if (recipe === "blur-field") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <filter id="b1" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${Math.round(width * 0.1)}"/>
    </filter>
    <filter id="b2" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${Math.round(width * 0.07)}"/>
    </filter>
    <filter id="b3" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${Math.round(width * 0.13)}"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="${bg}"/>
  <circle cx="${Math.round(width * 0.22)}" cy="${Math.round(height * 0.28)}" r="${Math.round(width * 0.42)}" fill="#c8d4f0" opacity="0.65" filter="url(#b1)"/>
  <circle cx="${Math.round(width * 0.78)}" cy="${Math.round(height * 0.65)}" r="${Math.round(width * 0.38)}" fill="#e8c4d8" opacity="0.55" filter="url(#b2)"/>
  <circle cx="${Math.round(width * 0.58)}" cy="${Math.round(height * 0.18)}" r="${Math.round(width * 0.3)}" fill="#b8e8e4" opacity="0.5" filter="url(#b3)"/>
  <circle cx="${Math.round(width * 0.35)}" cy="${Math.round(height * 0.82)}" r="${Math.round(width * 0.28)}" fill="#f0d8a0" opacity="0.4" filter="url(#b1)"/>
  <rect x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.35)}" width="${Math.round(width * 0.32)}" height="${Math.round(height * 0.45)}" rx="8" fill="${surface}" opacity="0.28" filter="url(#b2)"/>
</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  }

  // Each recipe gets a distinct gradient direction and character
  const gradients: Record<string, string> = {
    "cinematic-rain": `
      <linearGradient id="g" x1="0.3" y1="0" x2="0.7" y2="1">
        <stop offset="0%"   stop-color="${surface}"/>
        <stop offset="60%"  stop-color="${bg}"/>
        <stop offset="100%" stop-color="#020205"/>
      </linearGradient>`,
    "gallery-minimal": `
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${surface}"/>
        <stop offset="100%" stop-color="${bg}"/>
      </linearGradient>`,
    "brutalist-wall": `
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stop-color="${bg}"/>
        <stop offset="100%" stop-color="${surface}"/>
      </linearGradient>`,
    "soft-editorial": `
      <radialGradient id="g" cx="50%" cy="40%" r="70%">
        <stop offset="0%"   stop-color="${surface}"/>
        <stop offset="100%" stop-color="${bg}"/>
      </radialGradient>`,
    "surreal-film": `
      <radialGradient id="g" cx="30%" cy="60%" r="80%">
        <stop offset="0%"   stop-color="${surface}"/>
        <stop offset="60%"  stop-color="${bg}"/>
        <stop offset="100%" stop-color="#050308"/>
      </radialGradient>`,
    "archive-museum": `
      <linearGradient id="g" x1="0" y1="0" x2="0.05" y2="1">
        <stop offset="0%"   stop-color="${bg}"/>
        <stop offset="100%" stop-color="${surface}"/>
      </linearGradient>`,
    "experimental-type": `
      <linearGradient id="g" x1="1" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${bg}"/>
        <stop offset="100%" stop-color="${surface}"/>
      </linearGradient>`,
  };

  const grad = gradients[recipe] ?? gradients["cinematic-rain"];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>${grad}</defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
