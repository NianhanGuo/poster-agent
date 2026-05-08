import { NextRequest, NextResponse } from "next/server";

async function removeBackground(imageBuffer: Buffer): Promise<Buffer | null> {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) return null;

  const formData = new FormData();
  formData.append(
    "image_file",
    new Blob([imageBuffer.buffer as ArrayBuffer], { type: "image/png" }),
    "image.png",
  );
  formData.append("size", "auto");

  const res = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": apiKey },
    body: formData,
  });

  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

export async function POST(req: NextRequest) {
  // If no API key, tell the client immediately — no point reading the body
  if (!process.env.REMOVE_BG_API_KEY) {
    return NextResponse.json({
      url: null,
      hasTransparency: false,
      apiUnavailable: true,
      message: "Auto extraction requires a background-removal model (REMOVE_BG_API_KEY). Use manual lasso instead.",
    });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const cutout = await removeBackground(buffer);

    if (!cutout) {
      return NextResponse.json({
        url: null,
        hasTransparency: false,
        apiUnavailable: false,
        message: "No clear subject detected. Try the lasso tool for manual selection.",
      });
    }

    const base64 = `data:image/png;base64,${cutout.toString("base64")}`;
    return NextResponse.json({
      url: base64,
      mimeType: "image/png",
      hasTransparency: true,
    });
  } catch (err) {
    console.error("Subject extraction error:", err);
    return NextResponse.json({ error: "Failed to process image" }, { status: 500 });
  }
}
