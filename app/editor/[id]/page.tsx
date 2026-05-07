import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { EditorClient } from "@/components/editor/EditorClient";

type Params = { params: Promise<{ id: string }> };

export default async function EditorPage({ params }: Params) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!project) redirect("/dashboard");

  const serialized = {
    id: project.id,
    userId: project.userId,
    title: project.title,
    canvas: JSON.parse(project.canvas),
    layers: JSON.parse(project.layers),
    stylePreset: (project.stylePreset ?? "cinematic") as import("@/types/poster").StylePreset,
    posterType: (project.posterType ?? "film") as import("@/types/poster").PosterType,
    language: (project.language ?? "english") as import("@/types/poster").Language,
    promptHistory: JSON.parse(project.promptHistory),
    lockedLayers: JSON.parse(project.lockedLayers),
    thumbnail: project.thumbnail ?? undefined,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };

  return (
    <EditorClient
      initialProject={serialized}
      user={{ name: session.user.name, image: session.user.image }}
    />
  );
}
