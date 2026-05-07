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

async function enhancePrompt(rawPrompt: string, style: string): Promise<string> {
  // Only runs when ANTHROPIC_API_KEY is present
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `Create a detailed Stable Diffusion image generation prompt for a ${style} style poster background.
Base concept: ${rawPrompt}
Output ONLY the prompt text, no explanation. Make it vivid and specific.`,
      },
    ],
  });
  return msg.content[0].type === "text" ? msg.content[0].text : rawPrompt;
}

export async function POST(req: NextRequest) {
  const { prompt, style, width, height } = await req.json();

  try {
    // Enhance prompt only when Anthropic key is present
    const finalPrompt = process.env.ANTHROPIC_API_KEY
      ? await enhancePrompt(prompt, style)
      : prompt;

    const imageUrl = await generateWithReplicate(finalPrompt, width, height);

    if (imageUrl) {
      return NextResponse.json({ url: imageUrl, prompt: finalPrompt, demo: false });
    }

    // No Replicate token — return a gradient SVG data URL as the background
    const gradientUrl = mockGradientDataUrl(style, width, height);
    return NextResponse.json({ url: gradientUrl, prompt: finalPrompt, demo: true });
  } catch (err) {
    console.error("Image generation error:", err);
    // Even on error, return a gradient so the editor still opens
    const gradientUrl = mockGradientDataUrl(style ?? "cinematic", width ?? 800, height ?? 600);
    return NextResponse.json({ url: gradientUrl, demo: true });
  }
}
