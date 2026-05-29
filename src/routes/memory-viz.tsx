import { createFileRoute } from "@tanstack/react-router";
import { MemoryVisualization } from "../components/memory-visualization";

export const Route = createFileRoute("/memory-viz")({
	component: MemoryVizPage,
});

function MemoryVizPage() {
	return (
		<div>
			<h1 className="mb-6 text-2xl font-bold">Memory Visualization</h1>
			<MemoryVisualization />
		</div>
	);
}
