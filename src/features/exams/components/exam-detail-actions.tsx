import { BrainIcon, PlayIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ExamDetailActions() {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Button disabled>
				<PlayIcon data-icon="inline-start" />
				Iniciar quiz
			</Button>
			<Button disabled variant="outline">
				<BrainIcon data-icon="inline-start" />
				Explicações
			</Button>
			<Badge variant="secondary">Em breve</Badge>
		</div>
	);
}
