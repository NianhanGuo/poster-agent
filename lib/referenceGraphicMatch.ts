import type { PaletteColor } from "@/lib/colorExtract";

/**
 * Generates a blurred-abstract SVG background directly from extracted palette colors.
 * Used as a fallback when DALL-E ignores reference constraints for abstract/gradient references.
 * The output closely matches the visual character of blurred-gradient and abstract-poster references.
 */
export function buildGraphicMatchSvg(
  palette: PaletteColor[],
  width: number,
  height: number,
  styleClass?: string,
): string {
  const bg = palette[0]?.hex ?? "#f8f4f0";
  const colors = palette.slice(1).map((p) => p.hex);

  // Fill missing colors with tints of the dominant
  while (colors.length < 4) {
    colors.push(bg);
  }

  const blurLg = Math.round(Math.max(width, height) * 0.12);
  const blurMd = Math.round(Math.max(width, height) * 0.08);
  const blurSm = Math.round(Math.max(width, height) * 0.06);

  // Shape positions vary by styleClass
  const isGeometric = styleClass === "geometric-graphic";

  const shapes = isGeometric
    ? buildGeometricShapes(colors, width, height)
    : buildBlobShapes(colors, width, height, blurLg, blurMd, blurSm);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <filter id="blg" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="${blurLg}"/>
    </filter>
    <filter id="blm" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="${blurMd}"/>
    </filter>
    <filter id="bls" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="${blurSm}"/>
    </filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feBlend in="SourceGraphic" mode="overlay" result="blend"/>
      <feComposite in="blend" in2="SourceGraphic"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="${bg}"/>
  ${shapes}
  <rect width="100%" height="100%" fill="transparent" filter="url(#grain)" opacity="0.04"/>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function buildBlobShapes(
  colors: string[],
  w: number,
  h: number,
  blurLg: number,
  blurMd: number,
  blurSm: number,
): string {
  const [c0, c1, c2, c3] = colors;
  const cx = (f: number) => Math.round(w * f);
  const cy = (f: number) => Math.round(h * f);
  const cr = (f: number) => Math.round(Math.max(w, h) * f);

  return [
    // Large anchor blob — upper-left
    `<circle cx="${cx(0.20)}" cy="${cy(0.25)}" r="${cr(0.45)}" fill="${c0}" opacity="0.70" filter="url(#blg)"/>`,
    // Secondary blob — lower-right
    `<circle cx="${cx(0.78)}" cy="${cy(0.72)}" r="${cr(0.38)}" fill="${c1}" opacity="0.60" filter="url(#blg)"/>`,
    // Accent blob — upper-right
    `<circle cx="${cx(0.70)}" cy="${cy(0.20)}" r="${cr(0.28)}" fill="${c2}" opacity="0.50" filter="url(#blm)"/>`,
    // Subtle wash — lower-left
    `<circle cx="${cx(0.25)}" cy="${cy(0.78)}" r="${cr(0.30)}" fill="${c3}" opacity="0.40" filter="url(#blm)"/>`,
    // Small center highlight
    `<circle cx="${cx(0.50)}" cy="${cy(0.48)}" r="${cr(0.18)}" fill="${c0}" opacity="0.30" filter="url(#bls)"/>`,
    // Rect smear
    `<rect x="${cx(0.12)}" y="${cy(0.38)}" width="${cx(0.35)}" height="${cy(0.35)}"
          rx="50%" fill="${c1}" opacity="0.22" filter="url(#blm)"/>`,
  ].join("\n  ");
}

function buildGeometricShapes(colors: string[], w: number, h: number): string {
  const [c0, c1, c2, c3] = colors;
  const cx = (f: number) => Math.round(w * f);
  const cy = (f: number) => Math.round(h * f);

  return [
    // Large rectangle band
    `<rect x="${cx(0.0)}" y="${cy(0.30)}" width="${cx(1.0)}" height="${cy(0.40)}"
          fill="${c0}" opacity="0.35" filter="url(#blm)"/>`,
    // Circle left
    `<circle cx="${cx(0.22)}" cy="${cy(0.50)}" r="${cx(0.28)}" fill="${c1}" opacity="0.45" filter="url(#blm)"/>`,
    // Circle right
    `<circle cx="${cx(0.78)}" cy="${cy(0.50)}" r="${cx(0.22)}" fill="${c2}" opacity="0.40" filter="url(#blm)"/>`,
    // Thin horizontal line
    `<rect x="0" y="${cy(0.48)}" width="${cx(1.0)}" height="${cy(0.04)}"
          fill="${c3}" opacity="0.25" filter="url(#bls)"/>`,
    // Small center square
    `<rect x="${cx(0.40)}" y="${cy(0.38)}" width="${cx(0.20)}" height="${cy(0.24)}"
          rx="4" fill="${c0}" opacity="0.20" filter="url(#bls)"/>`,
  ].join("\n  ");
}
