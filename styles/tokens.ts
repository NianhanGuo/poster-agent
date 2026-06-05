/**
 * Design tokens — single source of truth for all UI styling decisions.
 *
 * Usage:
 *   import { t } from "@/styles/tokens";
 *   <div className={t.sectionLabel}>Layers</div>
 *   <input className={t.input.base} />
 *
 * All values produce Tailwind class strings so they tree-shake normally.
 * Inline style objects (dropdownStyle, backdropStyle) cover the small set of
 * CSS properties Tailwind v4 cannot express as utility classes.
 */

// ─── Type scale ───────────────────────────────────────────────────────────────
// Use these font-size tokens everywhere — never hardcode text-[Npx] directly.

export const scale = {
  /** Tiny metadata, mono values — 10px */
  xs:   "text-[10px]",
  /** Labels, section headers, secondary body — 11px */
  sm:   "text-[11px]",
  /** Input text, primary body, buttons — 12px */
  base: "text-[12px]",
  /** Headings, prominent labels — 13px */
  md:   "text-[13px]",
  /** Nav title, page-level text — 14px */
  lg:   "text-[14px]",
} as const;

// ─── Semantic text roles ───────────────────────────────────────────────────────

/** Panel / section header: "LAYERS", "FONT", "TYPOGRAPHY" */
export const sectionLabel =
  `${scale.sm} font-semibold tracking-widest uppercase text-zinc-500` as const;

/** Inline control label above a slider or input: "Size", "Color" */
export const controlLabel = `${scale.sm} font-medium text-zinc-500` as const;

/** Standard body text inside panels */
export const bodyText = `${scale.base} text-zinc-300` as const;

/** Secondary / muted description text */
export const mutedText = `${scale.sm} text-zinc-600` as const;

/** Monospaced numeric values — sliders, dimensions */
export const monoNumber = `font-mono ${scale.xs} text-zinc-500` as const;

// ─── Input fields ─────────────────────────────────────────────────────────────

export const input = {
  /** Standard bordered input — bg + border + focus ring */
  base: `w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 ${scale.base} text-zinc-200 outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-700`,

  /** Same as base but monospace (numbers, hex codes) */
  mono: `w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 font-mono ${scale.base} text-zinc-200 outline-none focus:border-zinc-600 transition-colors`,

  /** Borderless bottom-line input — used in PromptComposer main fields */
  underline: `w-full bg-transparent border-b border-zinc-800 focus:border-zinc-600 outline-none ${scale.base} text-zinc-200 placeholder:text-zinc-700 transition-colors`,
} as const;

// ─── Buttons ──────────────────────────────────────────────────────────────────

export const btn = {
  /** White filled — primary action (Export, Generate) */
  primary:
    `bg-white text-zinc-900 hover:bg-zinc-100 ${scale.md} font-semibold px-3 py-1.5 rounded-md transition-colors`,

  /** Bordered outline — secondary action */
  outline:
    `border border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-zinc-200 ${scale.base} font-medium py-1.5 px-3 rounded-md transition-colors`,

  /** No background, icon-button or nav link */
  ghost:
    `text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors px-2 py-1 rounded-md`,

  /** PromptComposer / setup option chip — active state */
  chipActive:
    `border border-zinc-500 text-zinc-100 bg-zinc-800 px-3 py-1.5 ${scale.sm} font-medium rounded-md transition-colors`,

  /** PromptComposer / setup option chip — inactive state */
  chipInactive:
    `border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 px-3 py-1.5 ${scale.sm} font-medium rounded-md transition-colors`,

  /** Small chip variant (inside tool panels) */
  chipSmActive:
    `border border-zinc-500 text-zinc-100 bg-zinc-800 px-2.5 py-1 ${scale.xs} font-medium rounded-md transition-colors`,
  chipSmInactive:
    `border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 px-2.5 py-1 ${scale.xs} font-medium rounded-md transition-colors`,
} as const;

// ─── Surface backgrounds ──────────────────────────────────────────────────────
// Prefer these over bg-zinc-* directly so changes propagate everywhere.

export const surface = {
  page:    "bg-black",
  panel:   "bg-zinc-950",
  canvas:  "bg-[#050507]",
  card:    "bg-zinc-900/40",
  input:   "bg-zinc-900",
  hover:   "hover:bg-zinc-800/60",
  active:  "bg-zinc-800",
} as const;

// ─── Borders ──────────────────────────────────────────────────────────────────

export const border = {
  default: "border-zinc-800/60",
  subtle:  "border-zinc-800",
  strong:  "border-zinc-700/80",
  focus:   "focus:border-zinc-600",
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────

export const radius = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-xl",
} as const;

// ─── Fixed heights ────────────────────────────────────────────────────────────

export const heights = {
  topbar:       "h-11",   // 44px — main navigation bar
  actionbar:    "h-8",    // 32px — sub-action row
  versionstrip: "h-8",    // 32px — version history strip
  layerRow:     "h-8",    // 32px — single layer row
  button:       "h-8",    // 32px — standard button height
  buttonSm:     "h-6",    // 24px — mode pill / compact button
} as const;

// ─── Spacing / gaps ───────────────────────────────────────────────────────────

export const gap = {
  section:  "space-y-10", // Between major form sections
  group:    "space-y-3",  // Within a section (label + controls)
  tight:    "space-y-2",  // Compact groups
  panelPad: "px-3",       // Horizontal padding inside panels
} as const;

// ─── Inline style objects (CSS values Tailwind cannot express) ─────────────────
// Kept minimal — only for things like boxShadow and backdrop-filter.

/** Dropdown / popover panel */
export const dropdownStyle = {
  background: "#141416",
  boxShadow:  "0 12px 32px rgba(0,0,0,0.6)",
} as const;

/** Modal overlay backdrop */
export const backdropStyle = {
  background:     "rgba(0,0,0,0.88)",
  backdropFilter: "blur(20px)",
} as const;

/** Top-bar blur — cannot be expressed as Tailwind class alone */
export const topbarBlur = {
  backdropFilter: "blur(20px)",
} as const;

// ─── Convenience shorthand ────────────────────────────────────────────────────
// `t` is the flat shorthand used in JSX: className={t.sectionLabel}

export const t = {
  sectionLabel,
  controlLabel,
  bodyText,
  mutedText,
  monoNumber,
  input,
  btn,
  surface,
  border,
  radius,
  heights,
  gap,
  scale,
  dropdownStyle,
  backdropStyle,
  topbarBlur,
} as const;

export default t;
