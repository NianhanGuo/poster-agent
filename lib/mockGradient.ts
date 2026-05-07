// Returns a base64 SVG data URL that works as a Konva Image src.
// Each style preset gets its own gradient palette.

const PALETTES: Record<string, [string, string, string]> = {
  cinematic:        ["#0d0d1a", "#12101e", "#06060f"],
  "gallery-minimal":["#ececec", "#e0e0dc", "#d4d4ce"],
  brutalist:        ["#0a0a0a", "#1a1a1a", "#000000"],
  editorial:        ["#f0ebe0", "#e4ddd0", "#d8d0c0"],
  surreal:          ["#1a0a2e", "#0e0a2a", "#200a38"],
  experimental:     ["#001a1a", "#0a001a", "#00000f"],
};

export function mockGradientDataUrl(
  style: string,
  width: number,
  height: number
): string {
  const [c0, c1, c2] = PALETTES[style] ?? PALETTES.cinematic;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="g" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%"   stop-color="${c0}"/>
      <stop offset="50%"  stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
