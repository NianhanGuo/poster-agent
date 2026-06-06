import { NextRequest, NextResponse } from "next/server";
import type { DesignBrief } from "@/types/poster";
import { RECIPES } from "@/lib/styleRecipes";
import type { RecipeDef } from "@/lib/styleRecipes";
import type { StyleRecipe } from "@/types/poster";
import { buildReferenceSection } from "@/lib/referencePrompt";
import type { EnrichedRefCtx } from "@/lib/referencePrompt";

const SYSTEM_PROMPT = `You are a world-class art director and design strategist.
You create concise, opinionated design briefs that push beyond safe defaults.
Your references: A24, Criterion Collection, MoMA, Tate Modern, ICA London, Taschen.
For product exhibit briefs: reference commercial advertising design — Apple, Muji, Bottega Veneta campaigns.
Output ONLY valid JSON — no markdown, no prose, no explanation.`;

function buildDemoBrief(recipe: RecipeDef): DesignBrief {
  const name = recipe.id;
  const map: Record<string, Partial<DesignBrief>> = {
    "product-exhibit":   { mood: "commercial clarity", composition: "asymmetric", typographyStrategy: "dominant-title", colorStrategy: "high-contrast", imageStrategy: "background-hero", negativeSpace: "medium" },
    "cinematic-rain":    { mood: "atmospheric dread", composition: "asymmetric", typographyStrategy: "dominant-title", colorStrategy: "high-contrast", imageStrategy: "background-hero", negativeSpace: "medium" },
    "gallery-minimal":   { mood: "refined silence",   composition: "center",     typographyStrategy: "subtle-type",    colorStrategy: "muted",          imageStrategy: "texture",          negativeSpace: "high"   },
    "brutalist-wall":    { mood: "confrontational weight", composition: "edge-heavy", typographyStrategy: "dominant-title", colorStrategy: "high-contrast", imageStrategy: "abstract",    negativeSpace: "low"    },
    "soft-editorial":    { mood: "intellectual warmth", composition: "asymmetric", typographyStrategy: "layered-type", colorStrategy: "muted",           imageStrategy: "background-hero",  negativeSpace: "medium" },
    "surreal-film":      { mood: "uncanny tension",   composition: "asymmetric", typographyStrategy: "layered-type",   colorStrategy: "duotone",        imageStrategy: "abstract",         negativeSpace: "medium" },
    "archive-museum":    { mood: "austere authority", composition: "grid",       typographyStrategy: "subtle-type",    colorStrategy: "muted",          imageStrategy: "background-hero",  negativeSpace: "medium" },
    "experimental-type": { mood: "typographic noise", composition: "edge-heavy", typographyStrategy: "dominant-title", colorStrategy: "high-contrast",  imageStrategy: "texture",          negativeSpace: "low"    },
    "blur-field":        { mood: "atmospheric stillness", composition: "asymmetric", typographyStrategy: "subtle-type", colorStrategy: "muted",          imageStrategy: "abstract",         negativeSpace: "high"   },
  };
  return {
    mood: "considered ambiguity",
    composition: "asymmetric",
    typographyStrategy: "layered-type",
    colorStrategy: "muted",
    imageStrategy: "background-hero",
    negativeSpace: "medium",
    designRationale: recipe.tagline,
    ...map[name],
  };
}

export async function POST(req: NextRequest) {
  const { prompt, posterType, styleRecipe, language, reference } = await req.json();
  const recipe = RECIPES[(styleRecipe as StyleRecipe)] ?? RECIPES["cinematic-rain"];
  const ref = reference as EnrichedRefCtx | undefined;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ brief: buildDemoBrief(recipe), demo: true });
  }

  const refSection = ref ? buildReferenceSection(ref, "brief") : "";

  const posterContext = posterType && posterType !== "poster"
    ? `Tonal context (soft hint only): ${posterType}`
    : "";

  const isProductExhibit = recipe.id === "product-exhibit";
  const productExhibitNote = isProductExhibit
    ? `\nPRODUCT EXHIBIT BRIEF: This is a commercial product advertisement poster.
Think like an advertising creative director. The imageStrategy should be "background-hero" (product is the hero).
The composition should showcase the product with maximum commercial impact.
Mood should reflect the product's emotional world (warm for food, premium for luxury, clean for beauty, etc.).
colorStrategy: derive from product category — avoid generic choices.` : "";

  const userPrompt = `Create an opinionated design brief for a poster.

Concept: ${prompt || "an intentionally designed poster"}
Style recipe: "${recipe.name}" — ${recipe.tagline}
${posterContext}
Language: ${language === "zh" ? "Chinese" : language === "mixed" ? "bilingual EN/ZH" : "English"}
${refSection}
${productExhibitNote}
Be deliberately opinionated. Avoid safe, average outputs. Push the concept.
${ref?.analysis?.visualSummary ? `The reference image shows: ${ref.analysis.visualSummary} — let this inform your mood and colorStrategy.` : ""}

Return exactly this JSON (no other keys):
{
  "mood": "<evocative phrase — e.g. 'bleak existential', 'luminous tension', 'brutalist calm'>",
  "composition": "center" | "asymmetric" | "grid" | "edge-heavy",
  "typographyStrategy": "dominant-title" | "subtle-type" | "layered-type",
  "colorStrategy": "high-contrast" | "muted" | "monochrome" | "duotone",
  "imageStrategy": "background-hero" | "abstract" | "texture" | "empty",
  "negativeSpace": "high" | "medium" | "low",
  "designRationale": "<one strong sentence explaining the core design decision>"
}`;

  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    const brief: DesignBrief = JSON.parse(text);
    return NextResponse.json({ brief, demo: false });
  } catch (err) {
    console.error("Design brief error:", err);
    return NextResponse.json({ brief: buildDemoBrief(recipe), demo: true });
  }
}
