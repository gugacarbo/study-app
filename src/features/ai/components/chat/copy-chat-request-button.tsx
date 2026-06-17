import { Check, ClipboardCopy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatChatRequestPayloadJson } from "@/features/ai/lib/build-chat-request-payload";
import { getChatRequestExportPayload } from "@/features/ai/lib/chat-request-export";
import { cn } from "@/lib/utils";

interface CopyChatRequestButtonProps {
	className?: string;
	title?: string;
	disabled?: boolean;
}

export function CopyChatRequestButton({
	className,
	title = "Copiar request JSON da conversa",
	disabled = false,
}: CopyChatRequestButtonProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		if (
			disabled ||
			typeof navigator === "undefined" ||
			!navigator.clipboard ||
			copied
		) {
			return;
		}

		const payload = getChatRequestExportPayload();
		if (!payload) return;

		navigator.clipboard.writeText(formatChatRequestPayloadJson(payload)).then(
			() => {
				setCopied(true);
				window.setTimeout(() => setCopied(false), 2000);
			},
			() => {},
		);
	};

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			className={cn("size-6 shrink-0", className)}
			onClick={handleCopy}
			disabled={disabled}
			title={copied ? "Copiado!" : title}
			aria-label={title}
		>
			{copied ? (
				<Check className="size-3.5 text-emerald-600" />
			) : (
				<ClipboardCopy className="size-3.5" />
			)}
		</Button>
	);
}
