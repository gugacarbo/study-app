import { createFileRoute } from "@tanstack/react-router";
import { MemoryPanel } from "../components/MemoryPanel";

export const Route = createFileRoute("/memory")({
  component: MemoryPage,
});

function MemoryPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Memory</h1>
      <MemoryPanel />
    </div>
  );
}
