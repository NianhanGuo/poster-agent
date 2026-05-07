import { EditorClient, EditorErrorBoundary } from "@/components/editor/EditorClient";

export default function EditorPage() {
  return (
    <EditorErrorBoundary>
      <EditorClient />
    </EditorErrorBoundary>
  );
}
