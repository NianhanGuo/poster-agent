/**
 * Generation Pipeline — single source of truth for routing generation requests.
 *
 * Every call to /api/generate/layout goes through selectPipeline() first.
 * The returned PipelineConfig drives which sub-steps run and how the Director
 * validates the result.
 */

import type { PosterSetupConfig } from "@/types/poster";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Pipeline = "collage" | "product-exhibit" | "reference-driven" | "preset-standard";

export interface PipelineConfig {
  id: Pipeline;
  /** Human-readable label shown in the editor status bar */
  label: string;
  /** One-line description of the pipeline's design philosophy */
  philosophy: string;
  /** Generate a DesignBrief before layout */
  generateBrief: boolean;
  /** Use GPT-4o to compose the layer layout */
  generateLayout: boolean;
  /** Run Flux to generate a background image */
  generateBackgroundImage: boolean;
  /** Uploaded subject images are required as primary visuals */
  requiresSubjectImages: boolean;
  /** Typography refinement pass is available (called manually in editor) */
  supportsTypographyRefinement: boolean;
  /** The Director must run a final composition review before returning */
  requiresDirectorApproval: boolean;
  /**
   * Design constraints forwarded to the Director's repair prompt.
   * These are injected verbatim into the Director's system prompt.
   */
  directorConstraints: string;
}

// ─── Pipeline definitions ─────────────────────────────────────────────────────

export const PIPELINE_CONFIGS: Record<Pipeline, PipelineConfig> = {

  "product-exhibit": {
    id:          "product-exhibit",
    label:       "Product Exhibit",
    philosophy:  "Commercial hero advertising. Background → Hero Product → Typography → Badge/CTA → Trust Signals → Brand Signals. Works for any product category.",
    generateBrief:              true,
    generateLayout:             true,
    generateBackgroundImage:    true,
    requiresSubjectImages:      false,
    supportsTypographyRefinement: true,
    requiresDirectorApproval:   true,
    directorConstraints: `
PRODUCT EXHIBIT PIPELINE — hard constraints:
- background/base layer MUST exist and cover 100% of canvas (x:0, y:0, full width and height).
- product/hero MUST be positioned using the layout variant's zone rules — NOT in the top-left corner.
- All text layers (text/headline, text/tagline, text/details) MUST stay within safe margins (5% padding).
- Typography hierarchy: text/headline dominates. tagline ≤ 50% of headline size. details ≤ 25%.
- badge/offer and trust/label layers must NOT cover the product's focal center.
- Layer names must follow the semantic convention: background/..., product/..., text/..., badge/..., trust/..., brand/...
- No emoji in any layer label.
- The fluxPrompt must match the product category's atmosphere (food=warm, beauty=clean, tech=minimal, etc).`,
  },

  collage: {
    id:          "collage",
    label:       "Collage",
    philosophy:  "Composition-first. Uploaded cutout photographs are the primary visual content. Flat geometric shapes and integrated typography build the poster around them.",
    generateBrief:              true,
    generateLayout:             true,
    generateBackgroundImage:    false,
    requiresSubjectImages:      true,
    supportsTypographyRefinement: true,
    requiresDirectorApproval:   true,
    directorConstraints: `
COLLAGE PIPELINE — hard constraints:
- NO AI-generated background image. solidBackground only.
- Uploaded subject images are the PRIMARY visual content — they must be prominent and unoccluded.
- All shapes must be flat solid fills. No gradients, shadows, or glows.
- Typography must physically interact with subjects or shapes (overlap, edge-align, or straddle a boundary).
- Subject images must overlap at least one geometric shape (the overlap IS the collage effect).
- The title should feel integrated into the composition — not floating.`,
  },

  "reference-driven": {
    id:          "reference-driven",
    label:       "Reference",
    philosophy:  "The uploaded reference poster drives all design decisions — palette, typography, composition, and image treatment. The preset recipe is suppressed.",
    generateBrief:              true,
    generateLayout:             true,
    generateBackgroundImage:    true,
    requiresSubjectImages:      false,
    supportsTypographyRefinement: true,
    requiresDirectorApproval:   true,
    directorConstraints: `
REFERENCE-DRIVEN PIPELINE — hard constraints:
- All fill colors must derive from the reference image's extracted palette.
- Typography style must match the reference (hierarchy, alignment, scale relationships).
- Composition structure must echo the reference spatial logic.
- The fluxPrompt-generated image must contain the user's concept, rendered in the reference style.
- Do NOT let preset recipe defaults override the reference.`,
  },

  "preset-standard": {
    id:          "preset-standard",
    label:       "Preset",
    philosophy:  "The selected style recipe drives all design decisions. The poster is a geometry-first graphic design composition — photography is subordinate to shape and typography.",
    generateBrief:              true,
    generateLayout:             true,
    generateBackgroundImage:    true,
    requiresSubjectImages:      false,
    supportsTypographyRefinement: true,
    requiresDirectorApproval:   true,
    directorConstraints: `
PRESET-STANDARD PIPELINE — hard constraints:
- Every image must be clipped to a geometric zone using clipShape — no full-bleed images.
- Typography must live in the flat-color zone, not on top of the image zone.
- There must be a clear hierarchy: title dominates at ≥1.5× the scale of any other text.
- Negative space is intentional — at least 30% of canvas must breathe.
- The solidBackground + clipped image is the design foundation; text and shapes build on top.`,
  },
};

// ─── Pipeline router ──────────────────────────────────────────────────────────

// Recipe ID sets — stored as Set<string> to avoid TypeScript TS2367 errors.
const COLLAGE_RECIPE_IDS        = new Set<string>(["collage-poster"]);
const PRODUCT_EXHIBIT_RECIPE_IDS = new Set<string>(["product-exhibit"]);

/** Returns true when the recipe uses the collage pipeline. */
export function isCollageRecipe(recipe: string): boolean {
  return COLLAGE_RECIPE_IDS.has(recipe);
}

/** Returns true when the recipe uses the product-exhibit pipeline. */
export function isProductExhibitRecipe(recipe: string): boolean {
  return PRODUCT_EXHIBIT_RECIPE_IDS.has(recipe);
}

/**
 * Selects the correct generation pipeline based on user setup.
 * This is the single routing decision point — use it everywhere.
 *
 * Precedence:
 *   1. collage-poster recipe → collage pipeline
 *   2. product-exhibit recipe → product-exhibit pipeline
 *   3. styleSource === "reference" → reference-driven pipeline
 *   4. everything else → preset-standard pipeline
 */
export function selectPipeline(setup: PosterSetupConfig): Pipeline {
  if (isCollageRecipe(setup.styleRecipe))        return "collage";
  if (isProductExhibitRecipe(setup.styleRecipe)) return "product-exhibit";
  if (setup.styleSource === "reference")         return "reference-driven";
  return "preset-standard";
}

/** Returns the full config for a given setup. Convenience wrapper. */
export function getPipelineConfig(setup: PosterSetupConfig): PipelineConfig {
  return PIPELINE_CONFIGS[selectPipeline(setup)];
}
