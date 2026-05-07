import { NextRequest, NextResponse } from "next/server";
import { mockGradientDataUrl } from "@/lib/mockGradient";

async function generateWithReplicate(
  prompt: string,
  width: number,
  height: number
): Promise<string | null> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return null;

  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version:
        "ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
      input: {
        prompt,
        width: Math.min(width, 1024),
        height: Math.min(height, 1024),
        num_outputs: 1,
        scheduler: "DPMSolverMultistep",
        num_inference_steps: 25,
      },
    }),
  });

  if (!res.ok) return null;
  const prediction = await res.json();

  let result = prediction;
  for (let i = 0; i < 30; i++) {
    if (result.status === "succeeded") return result.output?.[0] ?? null;
    if (result.status === "failed") return null;
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(
      `https://api.replicate.com/v1/predictions/${result.id}`,
      { headers: { Authorization: `Token ${token}` } }
    );
    result = await poll.json();
  }
  return null;
}

async function enhancePrompt(rawPrompt: string, styleRecipe: string): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `Create a Stable Diffusion prompt for a "${styleRecipe}" style poster background image. No text or typography in the image.
Concept: ${rawPrompt}
Output ONLY the prompt text. Be specific about lighting, mood, composition, and visual style.`,
      },
    ],
  });
  return msg.content[0].type === "text" ? msg.content[0].text : rawPrompt;
}

export async function POST(req: NextRequest) {
  const { prompt, styleRecipe, style, width, height } = await req.json();
  const recipe = styleRecipe ?? style ?? "cinematic-rain";

  try {
    const finalPrompt = process.env.ANTHROPIC_API_KEY
      ? await enhancePrompt(prompt, recipe)
      : prompt;

    const imageUrl = await generateWithReplicate(finalPrompt, width, height);

    if (imageUrl) {
      return NextResponse.json({ url: imageUrl, prompt: finalPrompt, demo: false });
    }

    const gradientUrl = mockGradientDataUrl(recipe, width, height);
    return NextResponse.json({ url: gradientUrl, prompt: finalPrompt, demo: true });
  } catch (err) {
    console.error("Image generation error:", err);
    const gradientUrl = mockGradientDataUrl(recipe, width ?? 800, height ?? 1200);
    return NextResponse.json({ url: gradientUrl, demo: true });
  }
}
