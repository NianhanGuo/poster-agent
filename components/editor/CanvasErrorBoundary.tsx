"use client";
import React from "react";

interface State { error: Error | null }

export class CanvasErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("PosterCanvas error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full gap-4">
          <p className="font-mono text-[11px] text-red-500/80">
            Canvas error — {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="font-mono text-[10px] tracking-[0.15em] uppercase text-zinc-600 hover:text-zinc-300 border border-zinc-800 px-3 py-1.5 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
