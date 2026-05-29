import { createFileRoute } from "@tanstack/react-router";
import { MemoryVisualization } from "../components/MemoryVisualization";

export const Route = createFileRoute("/memory")({
  component: MemoryPage,
});

function MemoryPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Memory Visualization</h1>
      <MemoryVisualization />
    </div>
  );
}
