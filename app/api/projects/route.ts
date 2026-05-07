import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      stylePreset: true,
      posterType: true,
      thumbnail: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const project = await prisma.project.create({
    data: {
      userId: session.user.id,
      title: body.title ?? "Untitled Poster",
      canvas: JSON.stringify(body.canvas ?? {}),
      layers: JSON.stringify(body.layers ?? []),
      stylePreset: body.stylePreset,
      posterType: body.posterType,
      language: body.language,
      promptHistory: JSON.stringify(body.promptHistory ?? []),
      lockedLayers: JSON.stringify(body.lockedLayers ?? []),
      thumbnail: body.thumbnail,
    },
  });

  return NextResponse.json({ project: serializeProject(project) });
}

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
