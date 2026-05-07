import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

async function removeBackground(imageBuffer: Buffer): Promise<Buffer | null> {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) return null;

  const formData = new FormData();
  formData.append(
    "image_file",
    new Blob([imageBuffer.buffer as ArrayBuffer], { type: "image/png" }),
    "image.png"
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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;
    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Try remove.bg first
    const cutout = await removeBackground(buffer);

    const filename = `${uuidv4()}.png`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");

    let savedPath: string;
    if (cutout) {
      await writeFile(path.join(uploadDir, filename), cutout);
      savedPath = `/uploads/${filename}`;
    } else {
      // Save original as fallback
      const origFilename = `${uuidv4()}-orig${path.extname(file.name)}`;
      await writeFile(path.join(uploadDir, origFilename), buffer);
      savedPath = `/uploads/${origFilename}`;
    }

    return NextResponse.json({
      url: savedPath,
      hasTransparency: !!cutout,
      message: cutout
        ? "Subject extracted successfully"
        : "REMOVE_BG_API_KEY not configured — original image saved. Configure the API key for automatic background removal.",
    });
  } catch (err) {
    console.error("Subject extraction error:", err);
    return NextResponse.json(
      { error: "Failed to process image" },
      { status: 500 }
    );
  }
}
