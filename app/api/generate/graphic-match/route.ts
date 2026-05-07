import { NextRequest, NextResponse } from "next/server";
import { buildGraphicMatchSvg } from "@/lib/referenceGraphicMatch";
import type { PaletteColor } from "@/lib/colorExtract";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    palette,
    width,
    height,
    styleClass,
  } = body as {
    palette: PaletteColor[];
    width: number;
    height: number;
    styleClass?: string;
  };

  if (!palette || palette.length === 0) {
    return NextResponse.json({ error: "palette required" }, { status: 400 });
  }

  const url = buildGraphicMatchSvg(
    palette,
    width  ?? 800,
    height ?? 1200,
    styleClass,
  );

  return NextResponse.json({ url, demo: false });
}
