import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { DashboardClient } from "@/components/DashboardClient";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

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

  return (
    <DashboardClient
      user={{ name: session.user.name, image: session.user.image }}
      initialProjects={projects.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }))}
    />
  );
}
