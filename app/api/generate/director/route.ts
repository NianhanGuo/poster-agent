/**
 * /api/generate/director — Creative Director: final composition approval.
 *
 * Receives the combined draft composition (layout layers + injected image URL)
 * and outputs the final approved layer JSON.
 *
 * Pipeline:
 *   1. Run all validation checks (geometry + design quality + pipeline-specific)
 *   2. If no errors → return immediately (no AI call needed)
 *   3. If errors → send to GPT-4o Director for targeted repair (up to 2 attempts)
 *   4. Return approved layers + verdict + remaining issues
 *
 * The Director never redesigns from scratch — it makes surgical repairs only.
 */

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import type { PosterLayer, PosterSetupConfig, CanvasConfig, DesignBrief, CanvasSize } from "@/types/poster";
import { CANVAS_SIZES } from "@/types/poster";
import type { Pipeline } from "@/lib/generationPipeline";
import { selectPipeline, getPipelineConfig } from "@/lib/generationPipeline";
import {
  validatePosterLayout,
  validateCollageLayout,
  validateDesignQuality,
  validateProductExhibitLayout,
  formatIssuesForDirector,
  summariseIssues,
  type ValidationIssue,
} from "@/lib/posterValidation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DirectorRequest {
  layers: PosterLayer[];
  setup: PosterSetupConfig;
  /** Canvas config — if omitted, derived from setup.canvasSize */
  canvas?: CanvasConfig;
  brief?: DesignBrief;
  /** Which pipeline produced these draft layers */
  pipeline?: Pipeline;
}

interface DirectorResponse {
  approved: boolean;
  layers: PosterLayer[];
  verdict: string;
  validationSummary: string;
  issues: ValidationIssue[];
  repairsApplied: boolean;
  demo: boolean;
}

// ─── Canvas helper ────────────────────────────────────────────────────────────

function resolveCanvas(setup: PosterSetupConfig, override?: CanvasConfig): CanvasConfig {
  if (override) return override;
  if (setup.canvasSize === "custom") {
    return { size: "custom", width: setup.customWidth ?? 800, height: setup.customHeight ?? 1200 };
  }
  return CANVAS_SIZES[setup.canvasSize as Exclude<CanvasSize, "custom">];
}

// ─── Director system prompt ───────────────────────────────────────────────────

function buildDirectorSystemPrompt(pipelineConfig: ReturnType<typeof getPipelineConfig>): string {
  return `You are a Senior Creative Director at a world-class design studio.
Standards: Pentagram, Studio Dumbar, A24, Criterion Collection.
You review final poster compositions before they go to print.

Your role is SURGICAL REPAIR, not redesign:
- Fix only the issues listed in the user prompt
- Do NOT change layer types, text content, or colors unless the issue explicitly requires it
- Do NOT move background layers (solidBackground, noiseTexture, backgroundImage)
- PRESERVE the overall composition intent and design style
- Maintain relative visual hierarchy: title > subtitle > body > meta

PIPELINE: ${pipelineConfig.id}
${pipelineConfig.directorConstraints}

Return ONLY valid JSON — no markdown, no explanation, no code fences.`;
}

// ─── Director repair prompt ───────────────────────────────────────────────────

function buildDirectorRepairPrompt(
  layers: PosterLayer[],
  issues: ValidationIssue[],
  canvas: CanvasConfig,
  brief: DesignBrief | undefined,
  concept: string,
): string {
  const W = canvas.width;
  const H = canvas.height;
  const errorCount   = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  const briefSection = brief
    ? `\nDESIGN BRIEF (preserve this intent):
  Mood: ${brief.mood}
  Composition: ${brief.composition}
  Typography: ${brief.typographyStrategy}
  Negative space: ${brief.negativeSpace}${brief.designRationale ? `\n  Rationale: ${brief.designRationale}` : ""}`
    : "";

  return `CANVAS: ${W} × ${H}px
SAFE MARGINS: 40px all sides
CONCEPT: "${concept || "poster"}"
${briefSection}

ISSUES TO FIX (${errorCount} error(s), ${warningCount} warning(s)):
Fix ALL errors. Fix warnings only if the repair is straightforward and doesn't damage composition.

${formatIssuesForDirector(issues)}

CURRENT LAYERS — repair and return ALL of them:
${JSON.stringify(layers, null, 2)}

REPAIR RULES:

out-of-canvas errors:
  x≥0, y≥0, x+width≤${W}, y+height≤${H}
  For rotated layers: reduce rotation toward 0° until AABB fits, or shrink dimensions.

safe-margin errors (text only):
  x≥40, y≥40, x+width≤${W - 40}, y+height≤${H - 40}
  If too wide: reduce width to ${W - 80}, then scale fontSize proportionally.

small-font warnings:
  Increase fontSize to the minimum stated in the issue.

low-opacity errors:
  Set opacity ≥ 0.2.

z-order errors:
  Set titleText zIndex ≥ solidBackground zIndex + 3.

focal-overlap warnings:
  Reduce covering layer opacity to ≤0.35, or reposition.

hierarchy warnings:
  Increase titleText fontSize until it is ≥1.8× the subordinate layer cited.
  Do NOT decrease subordinate text — increase the title.

composition-relationship warnings (floating shape):
  Move the shape to be within 60px of at least one text or image layer.
  Do not move background layers.

composition-relationship warnings (floating title):
  Move the title within 140px of the nearest image or shape.
  Preserve alignment (left/center/right) unless alignment itself is the issue.

subject-coverage warnings:
  Reduce the covering layer opacity to ≤0.4, or move it to stop covering the image.

Return JSON:
{
  "layers": [ ...ALL layers including unchanged ones... ],
  "directorNotes": "one sentence: what was changed and why"
}`;
}

// ─── Main route handler ───────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<DirectorResponse>> {
  const body: DirectorRequest = await req.json();
  const { layers, setup, brief } = body;

  const canvas   = resolveCanvas(setup, body.canvas);
  const pipeline = body.pipeline ?? selectPipeline(setup);
  const pipelineCfg = getPipelineConfig(setup);

  // ── Run all validation checks ──────────────────────────────────────────────
  let issues: ValidationIssue[] = [
    ...validatePosterLayout(layers, canvas),
    ...validateDesignQuality(layers, canvas),
    ...(pipeline === "collage"          ? validateCollageLayout(layers, canvas)        : []),
    ...(pipeline === "product-exhibit"  ? validateProductExhibitLayout(layers, canvas) : []),
  ];

  const summary = summariseIssues(issues);
  console.log(`[director] Pipeline: ${pipeline} | Validation: ${summary}`);

  // ── No API key — return validation result without repair ───────────────────
  if (!process.env.OPENAI_API_KEY) {
    const errors = issues.filter((i) => i.severity === "error").length;
    return NextResponse.json({
      approved:          errors === 0,
      layers,
      verdict:           errors === 0
        ? "Composition approved (demo — no AI review)"
        : `${errors} error(s) found (demo — repairs skipped)`,
      validationSummary: summary,
      issues,
      repairsApplied:    false,
      demo:              true,
    });
  }

  // ── No errors → approve immediately (no GPT-4o call) ──────────────────────
  const initialErrors = issues.filter((i) => i.severity === "error").length;
  if (initialErrors === 0) {
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    return NextResponse.json({
      approved:          true,
      layers,
      verdict:           warningCount === 0
        ? "Composition approved — all validation checks passed"
        : `Composition approved with ${warningCount} minor warning(s)`,
      validationSummary: summary,
      issues,
      repairsApplied:    false,
      demo:              false,
    });
  }

  // ── GPT-4o repair loop (up to 2 attempts) ─────────────────────────────────
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let resultLayers = layers.map((l) => ({ ...l, id: l.id || uuidv4() }));
  let directorNotes = "";
  const systemPrompt = buildDirectorSystemPrompt(pipelineCfg);

  for (let attempt = 0; attempt < 2; attempt++) {
    const errorCount = issues.filter((i) => i.severity === "error").length;
    if (errorCount === 0) break;

    console.log(`[director] Repair attempt ${attempt + 1} — ${errorCount} error(s)`);

    try {
      const completion = await openai.chat.completions.create({
        model:           "gpt-4o",
        max_tokens:      4096,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role:    "user",
            content: buildDirectorRepairPrompt(
              resultLayers,
              issues,
              canvas,
              brief,
              setup.prompt ?? "",
            ),
          },
        ],
      });

      const text   = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(text) as {
        layers?: PosterLayer[];
        directorNotes?: string;
      };

      if (Array.isArray(parsed.layers) && parsed.layers.length > 0) {
        resultLayers = parsed.layers.map((l) => ({
          ...l,
          id:      l.id      || uuidv4(),
          visible: l.visible ?? true,
          locked:  l.locked  ?? false,
        }));
        directorNotes = parsed.directorNotes ?? "";
        console.log(`[director] Repair ${attempt + 1} notes: ${directorNotes}`);
      }

      // Re-validate after repair
      issues = [
        ...validatePosterLayout(resultLayers, canvas),
        ...validateDesignQuality(resultLayers, canvas),
        ...(pipeline === "collage"         ? validateCollageLayout(resultLayers, canvas)        : []),
        ...(pipeline === "product-exhibit" ? validateProductExhibitLayout(resultLayers, canvas) : []),
      ];
      console.log(`[director] After repair ${attempt + 1}: ${summariseIssues(issues)}`);
    } catch (err) {
      console.error(`[director] Repair ${attempt + 1} failed:`, err);
      break;
    }
  }

  const finalErrors   = issues.filter((i) => i.severity === "error").length;
  const finalWarnings = issues.filter((i) => i.severity === "warning").length;
  const approved      = finalErrors === 0;

  const verdict = approved
    ? finalWarnings === 0
      ? `Composition approved by Director${directorNotes ? ` — ${directorNotes}` : ""}`
      : `Composition approved with ${finalWarnings} warning(s)${directorNotes ? ` — ${directorNotes}` : ""}`
    : `Director could not fully resolve ${finalErrors} error(s) — returning best available composition`;

  console.log(`[director] Final: ${approved ? "APPROVED" : "PARTIAL"} | ${summariseIssues(issues)}`);

  return NextResponse.json({
    approved,
    layers:            resultLayers,
    verdict,
    validationSummary: summariseIssues(issues),
    issues,
    repairsApplied:    true,
    demo:              false,
  });
}
