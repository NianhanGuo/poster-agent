"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { PosterSetupModal } from "./setup/PosterSetupModal";

interface ProjectSummary {
  id: string;
  title: string;
  stylePreset: string | null;
  posterType: string | null;
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  user: { name?: string | null; image?: string | null };
  initialProjects: ProjectSummary[];
}

export function DashboardClient({ user, initialProjects }: Props) {
  const [projects, setProjects] = useState(initialProjects);
  const [showSetup, setShowSetup] = useState(false);
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("Delete this project?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((p) => p.filter((proj) => proj.id !== id));
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
            P
          </div>
          <span className="font-semibold text-white">Poster Agent</span>
        </div>
        <div className="flex items-center gap-4">
          {user.image && (
            <img
              src={user.image}
              alt={user.name ?? "User"}
              className="w-8 h-8 rounded-full"
            />
          )}
          <span className="text-sm text-zinc-400">{user.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">My Posters</h1>
            <p className="text-zinc-400 text-sm mt-1">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowSetup(true)}
            className="bg-violet-600 hover:bg-violet-500 text-white font-medium px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2"
          >
            <span>+</span> New Poster
          </button>
        </div>

        {/* Grid */}
        {projects.length === 0 ? (
          <div className="text-center py-24 text-zinc-500">
            <div className="text-5xl mb-4">🎨</div>
            <p className="text-lg font-medium text-zinc-400">No posters yet</p>
            <p className="text-sm mt-2">Create your first poster to get started</p>
            <button
              onClick={() => setShowSetup(true)}
              className="mt-6 bg-violet-600 hover:bg-violet-500 text-white font-medium px-6 py-3 rounded-lg transition-colors"
            >
              Create Poster
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {projects.map((p) => (
              <div
                key={p.id}
                className="group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors"
              >
                <Link href={`/editor/${p.id}`}>
                  <div className="aspect-[3/4] bg-zinc-800 overflow-hidden flex items-center justify-center">
                    {p.thumbnail ? (
                      <img
                        src={p.thumbnail}
                        alt={p.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-zinc-600 text-4xl">🎨</div>
                    )}
                  </div>
                </Link>
                <div className="p-3">
                  <Link href={`/editor/${p.id}`}>
                    <h3 className="font-medium text-sm text-white truncate hover:text-violet-400 transition-colors">
                      {p.title}
                    </h3>
                  </Link>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-zinc-500 capitalize">
                      {p.posterType ?? "poster"} · {p.stylePreset ?? "custom"}
                    </span>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-xs text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-xs text-zinc-600 mt-1">
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showSetup && (
        <PosterSetupModal
          onClose={() => setShowSetup(false)}
          onCreate={(projectId) => router.push(`/editor/${projectId}`)}
        />
      )}
    </div>
  );
}
