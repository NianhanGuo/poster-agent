import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

function serializeProject(p: {
  id: string;
  userId: string;
  title: string;
  canvas: string;
  layers: string;
  stylePreset: string | null;
  posterType: string | null;
  language: string | null;
  promptHistory: string;
  lockedLayers: string;
  thumbnail: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...p,
    canvas: JSON.parse(p.canvas),
    layers: JSON.parse(p.layers),
    promptHistory: JSON.parse(p.promptHistory),
    lockedLayers: JSON.parse(p.lockedLayers),
  };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ project: serializeProject(project) });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.project.update({
    where: { id },
    data: {
      title: body.title ?? existing.title,
      canvas: body.canvas ? JSON.stringify(body.canvas) : existing.canvas,
      layers: body.layers ? JSON.stringify(body.layers) : existing.layers,
      stylePreset: body.stylePreset ?? existing.stylePreset,
      posterType: body.posterType ?? existing.posterType,
      language: body.language ?? existing.language,
      promptHistory: body.promptHistory
        ? JSON.stringify(body.promptHistory)
        : existing.promptHistory,
      lockedLayers: body.lockedLayers
        ? JSON.stringify(body.lockedLayers)
        : existing.lockedLayers,
      thumbnail: body.thumbnail ?? existing.thumbnail,
    },
  });

  return NextResponse.json({ project: serializeProject(updated) });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
