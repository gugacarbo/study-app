import type { FC } from "react";

interface SyntaxHighlighterProps {
	code: string;
	language?: string;
}

export const SyntaxHighlighter: FC<SyntaxHighlighterProps> = ({ code }) => {
	return <code>{code}</code>;
};
