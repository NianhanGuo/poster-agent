import type { StyleRecipe } from "@/types/poster";
import { RECIPES } from "@/lib/styleRecipes";

export function mockGradientDataUrl(
  recipe: StyleRecipe | string,
  width: number,
  height: number,
): string {
  const def = RECIPES[recipe as StyleRecipe] ?? RECIPES["cinematic-rain"];
  const { bg, surface } = def.palette;

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
