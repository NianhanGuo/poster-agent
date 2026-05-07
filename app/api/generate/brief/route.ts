import { NextRequest, NextResponse } from "next/server";
import type { DesignBrief } from "@/types/poster";
import { RECIPES } from "@/lib/styleRecipes";
import type { RecipeDef } from "@/lib/styleRecipes";
import type { StyleRecipe } from "@/types/poster";

const SYSTEM_PROMPT = `You are a world-class art director and design strategist.
You create concise, opinionated design briefs that push beyond safe defaults.
Your references: A24, Criterion Collection, MoMA, Tate Modern, ICA London, Taschen.
Output ONLY valid JSON — no markdown, no prose, no explanation.`;

function buildDemoBrief(recipe: RecipeDef): DesignBrief {
  const name = recipe.id;
  const map: Record<string, Partial<DesignBrief>> = {
    "cinematic-rain":    { mood: "atmospheric dread", composition: "asymmetric", typographyStrategy: "dominant-title", colorStrategy: "high-contrast", imageStrategy: "background-hero", negativeSpace: "medium" },
    "gallery-minimal":   { mood: "refined silence",   composition: "center",     typographyStrategy: "subtle-type",    colorStrategy: "muted",          imageStrategy: "texture",          negativeSpace: "high"   },
    "brutalist-wall":    { mood: "confrontational weight", composition: "edge-heavy", typographyStrategy: "dominant-title", colorStrategy: "high-contrast", imageStrategy: "abstract",    negativeSpace: "low"    },
    "soft-editorial":    { mood: "intellectual warmth", composition: "asymmetric", typographyStrategy: "layered-type", colorStrategy: "muted",           imageStrategy: "background-hero",  negativeSpace: "medium" },
    "surreal-film":      { mood: "uncanny tension",   composition: "asymmetric", typographyStrategy: "layered-type",   colorStrategy: "duotone",        imageStrategy: "abstract",         negativeSpace: "medium" },
    "archive-museum":    { mood: "austere authority", composition: "grid",       typographyStrategy: "subtle-type",    colorStrategy: "muted",          imageStrategy: "background-hero",  negativeSpace: "medium" },
    "experimental-type": { mood: "typographic noise", composition: "edge-heavy", typographyStrategy: "dominant-title", colorStrategy: "high-contrast",  imageStrategy: "texture",          negativeSpace: "low"    },
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

  const refNotes: string[] = [];
  if (reference?.instruction) refNotes.push(`Reference instruction: "${reference.instruction}"`);
  if (reference?.strength > 50) {
    const targets = Object.entries(reference.targets ?? {})
      .filter(([, v]) => v).map(([k]) => k).join(", ");
    if (targets) refNotes.push(`Strong influence on: ${targets}`);
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ brief: buildDemoBrief(recipe), demo: true });
  }

  const userPrompt = `Create an opinionated design brief for a ${posterType} poster.

Concept: ${prompt || `a ${posterType} poster`}
Style recipe: "${recipe.name}" — ${recipe.tagline}
Language: ${language === "zh" ? "Chinese" : language === "mixed" ? "bilingual EN/ZH" : "English"}
${refNotes.length ? refNotes.join("\n") : ""}

Be deliberately opinionated. Avoid safe, average outputs. Push the concept.

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
