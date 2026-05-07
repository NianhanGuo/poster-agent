import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Uses Replicate if configured, otherwise falls back to a placeholder gradient
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

  // Poll for result
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

// Enhance the prompt using Claude before sending to image gen
async function enhancePrompt(
  rawPrompt: string,
  style: string
): Promise<string> {
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
    const enhanced = await enhancePrompt(prompt, style);
    const imageUrl = await generateWithReplicate(enhanced, width, height);

    if (imageUrl) {
      return NextResponse.json({ url: imageUrl, prompt: enhanced });
    }

    // Fallback: return a placeholder data URL (dark gradient)
    return NextResponse.json({
      url: null,
      placeholder: true,
      prompt: enhanced,
      message:
        "Image generation unavailable — configure REPLICATE_API_TOKEN for AI image generation",
    });
  } catch (err) {
    console.error("Image generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}
