export type FontCategory = "sans" | "serif" | "display" | "script" | "mono";

export interface FontDef {
  family: string;
  category: FontCategory;
  weights: number[];
  tags: string;
}

// Curated Google Fonts covering all style aesthetics
export const FONT_LIST: FontDef[] = [
  // Sans-serif — Swiss / Clean / Avant-Garde
  { family: "Inter",              category: "sans",    weights: [100,200,300,400,500,600,700,800,900], tags: "clean neutral ui modern" },
  { family: "DM Sans",            category: "sans",    weights: [100,200,300,400,500,600,700,800,900], tags: "clean geometric modern" },
  { family: "Plus Jakarta Sans",  category: "sans",    weights: [200,300,400,500,600,700,800],         tags: "clean geometric friendly" },
  { family: "Urbanist",           category: "sans",    weights: [100,200,300,400,500,600,700,800,900], tags: "geometric swiss clean minimal" },
  { family: "Space Grotesk",      category: "sans",    weights: [300,400,500,600,700],                 tags: "avant-garde tech geometric quirky" },
  { family: "Syne",               category: "sans",    weights: [400,500,600,700,800],                 tags: "avant-garde experimental poster" },
  { family: "Outfit",             category: "sans",    weights: [100,200,300,400,500,600,700,800,900], tags: "geometric modern rounded" },
  { family: "Barlow",             category: "sans",    weights: [100,200,300,400,500,600,700,800,900], tags: "condensed graphic clean" },
  { family: "Barlow Condensed",   category: "sans",    weights: [100,200,300,400,500,600,700,800,900], tags: "condensed graphic impact" },
  { family: "Oswald",             category: "sans",    weights: [200,300,400,500,600,700],             tags: "condensed bold graphic impact" },
  { family: "Familjen Grotesk",   category: "sans",    weights: [400,500,600,700,800],                 tags: "experimental geometric quirky editorial" },

  // Display — Graphic / Impact / Expressive / Brutal
  { family: "Bebas Neue",         category: "display", weights: [400],                                 tags: "impact bold all-caps graphic brutal" },
  { family: "Anton",              category: "display", weights: [400],                                 tags: "impact bold condensed headline" },
  { family: "Black Han Sans",     category: "display", weights: [400],                                 tags: "bold black impact cjk" },
  { family: "Righteous",          category: "display", weights: [400],                                 tags: "retro rounded display funky" },
  { family: "Boogaloo",           category: "display", weights: [400],                                 tags: "retro funky casual friendly" },
  { family: "Alfa Slab One",      category: "display", weights: [400],                                 tags: "slab bold impact display" },
  { family: "Lobster",            category: "display", weights: [400],                                 tags: "retro script display ornate" },
  { family: "Abril Fatface",      category: "display", weights: [400],                                 tags: "editorial bold elegant display" },
  { family: "Playfair Display",   category: "display", weights: [400,500,600,700,800,900],             tags: "high-fashion editorial elegant serif" },
  { family: "Cormorant",          category: "display", weights: [300,400,500,600,700],                 tags: "high-fashion elegant luxury editorial" },
  { family: "Cormorant Garamond", category: "display", weights: [300,400,500,600,700],                 tags: "high-fashion elegant refined serif" },
  { family: "Libre Baskerville",  category: "display", weights: [400,700],                             tags: "classic serif editorial literary" },
  { family: "Orbitron",           category: "display", weights: [400,500,600,700,800,900],             tags: "techno sci-fi futuristic geometric" },
  { family: "Audiowide",          category: "display", weights: [400],                                 tags: "techno sci-fi futuristic" },
  { family: "Rajdhani",           category: "display", weights: [300,400,500,600,700],                 tags: "techno geometric condensed" },
  { family: "Saira Condensed",    category: "display", weights: [100,200,300,400,500,600,700,800,900], tags: "condensed technical display" },
  { family: "Unbounded",          category: "display", weights: [200,300,400,500,600,700,800,900],     tags: "experimental geometric futuristic bold" },
  { family: "Bodoni Moda",        category: "display", weights: [400,500,600,700,800,900],             tags: "high-fashion luxury editorial elegant contrast" },
  { family: "Fraunces",           category: "display", weights: [100,200,300,400,500,600,700,800,900], tags: "literary vintage optical editorial warm" },

  // Serif — Elegant / Editorial / Archive
  { family: "EB Garamond",        category: "serif",   weights: [400,500,600,700,800],                 tags: "classical elegant literary museum" },
  { family: "Lora",               category: "serif",   weights: [400,500,600,700],                     tags: "literary warm editorial soft" },
  { family: "Merriweather",       category: "serif",   weights: [300,400,700,900],                     tags: "readable literary warm serif" },
  { family: "Spectral",           category: "serif",   weights: [200,300,400,500,600,700,800],         tags: "elegant literary refined" },
  { family: "Crimson Pro",        category: "serif",   weights: [200,300,400,500,600,700,800,900],     tags: "literary elegant book-like" },
  { family: "Arvo",               category: "serif",   weights: [400,700],                             tags: "slab serif retro sturdy" },
  { family: "Cardo",              category: "serif",   weights: [400,700],                             tags: "classical scholarly literary" },
  { family: "IM Fell English",    category: "serif",   weights: [400],                                 tags: "archival antique historical editorial museum" },
  { family: "Instrument Serif",   category: "serif",   weights: [400],                                 tags: "elegant refined contemporary editorial" },

  // Script / Handcrafted
  { family: "Dancing Script",     category: "script",  weights: [400,500,600,700],                     tags: "handwritten elegant flowing" },
  { family: "Pacifico",           category: "script",  weights: [400],                                 tags: "retro casual fun handwritten" },
  { family: "Caveat",             category: "script",  weights: [400,500,600,700],                     tags: "handwritten casual sketchy" },
  { family: "Sacramento",         category: "script",  weights: [400],                                 tags: "calligraphic elegant thin" },
  { family: "Great Vibes",        category: "script",  weights: [400],                                 tags: "calligraphic flowing luxury" },
  { family: "Satisfy",            category: "script",  weights: [400],                                 tags: "handwritten elegant flowing" },

  // Mono — Techno / Expressive
  { family: "Space Mono",         category: "mono",    weights: [400,700],                             tags: "techno expressive type-as-image editorial" },
  { family: "Courier Prime",      category: "mono",    weights: [400,700],                             tags: "typewriter vintage editorial" },
  { family: "IBM Plex Mono",      category: "mono",    weights: [100,200,300,400,500,600,700],         tags: "techno clean data modern" },
  { family: "Share Tech Mono",    category: "mono",    weights: [400],                                 tags: "techno terminal sci-fi" },
  { family: "Syne Mono",          category: "mono",    weights: [400],                                 tags: "experimental avant-garde type-as-image" },
  { family: "DM Mono",            category: "mono",    weights: [300,400,500],                         tags: "clean geometric minimal code" },
];

// Curated picker groups for the FontPicker UI
export const CURATED_FONT_GROUPS: Record<string, string[]> = {
  "Serif Display":  ["Cormorant Garamond", "Playfair Display", "IM Fell English", "Libre Baskerville", "Fraunces", "Bodoni Moda"],
  "Sans Display":   ["Anton", "Bebas Neue", "Syne", "DM Sans", "Space Grotesk", "Inter"],
  "Mono":           ["Space Mono", "IBM Plex Mono", "Courier Prime", "DM Mono", "Syne Mono"],
  "Experimental":   ["Unbounded", "Familjen Grotesk", "Instrument Serif"],
};

const loaded = new Set<string>();

export function loadFontsFromLayers(
  layers: { textData?: { fontFamily?: string } }[],
  extraFamilies?: string[],
): void {
  const families = new Set<string>();
  for (const l of layers) {
    if (l.textData?.fontFamily) families.add(l.textData.fontFamily);
  }
  if (extraFamilies) extraFamilies.forEach((f) => families.add(f));
  families.forEach((family) => {
    const def = FONT_LIST.find((f) => f.family === family);
    loadGoogleFont(family, def?.weights ?? [400, 700]);
  });
}

export function loadGoogleFont(family: string, weights: number[] = [400, 700]): void {
  const key = `${family}:${weights.join(",")}`;
  if (loaded.has(key) || typeof document === "undefined") return;
  loaded.add(key);
  const id = `gfont-${family.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  // Google Fonts CSS2 API — load all requested weights including italics
  const wgts = weights.map((w) => `0,${w};1,${w}`).join(";");
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@${wgts}&display=swap`;
  document.head.appendChild(link);
}

export function getFontDef(family: string): FontDef | undefined {
  return FONT_LIST.find((f) => f.family === family);
}

export function searchFonts(query: string, category?: FontCategory): FontDef[] {
  const q = query.toLowerCase().trim();
  return FONT_LIST.filter((f) => {
    const matchCat = !category || f.category === category;
    const matchQ = !q || f.family.toLowerCase().includes(q) || f.tags.includes(q);
    return matchCat && matchQ;
  });
}
