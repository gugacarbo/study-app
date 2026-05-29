import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
	content: string;
	className?: string;
	prose?: boolean;
}

const defaultComponents: Components = {
	// Ensure paragraphs don't add extra bottom margin in tight spaces
	p: ({ children, ...props }) => (
		<p className="last:mb-0" {...props}>
			{children}
		</p>
	),
	// Style inline code
	code: ({ children, className, ...props }) => {
		const isInline = !className;
		if (isInline) {
			return (
				<code
					className="rounded bg-muted/60 px-1 py-0.5 text-sm font-mono text-foreground"
					{...props}
				>
					{children}
				</code>
			);
		}
		return (
			<code
				className={
					className +
					" block rounded-md bg-muted/60 p-3 text-sm overflow-x-auto"
				}
				{...props}
			>
				{children}
			</code>
		);
	},
	// Style links
	a: ({ children, href, ...props }) => (
		<a
			href={href}
			className="text-primary underline underline-offset-2 hover:text-primary-hover"
			target="_blank"
			rel="noopener noreferrer"
			{...props}
		>
			{children}
		</a>
	),
	// Style lists
	ul: ({ children, ...props }) => (
		<ul className="list-disc pl-5 space-y-1" {...props}>
			{children}
		</ul>
	),
	ol: ({ children, ...props }) => (
		<ol className="list-decimal pl-5 space-y-1" {...props}>
			{children}
		</ol>
	),
	// Style blockquotes
	blockquote: ({ children, ...props }) => (
		<blockquote
			className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground"
			{...props}
		>
			{children}
		</blockquote>
	),
	// Style headings
	h1: ({ children, ...props }) => (
		<h1 className="text-xl font-bold mb-2 mt-4 first:mt-0" {...props}>
			{children}
		</h1>
	),
	h2: ({ children, ...props }) => (
		<h2 className="text-lg font-bold mb-1.5 mt-3 first:mt-0" {...props}>
			{children}
		</h2>
	),
	h3: ({ children, ...props }) => (
		<h3 className="text-base font-semibold mb-1 mt-2 first:mt-0" {...props}>
			{children}
		</h3>
	),
	// Style tables (from GFM)
	table: ({ children, ...props }) => (
		<div className="overflow-x-auto my-2">
			<table
				className="min-w-full border-collapse text-sm border border-border"
				{...props}
			>
				{children}
			</table>
		</div>
	),
	th: ({ children, ...props }) => (
		<th
			className="border border-border bg-muted/40 px-3 py-2 text-left font-semibold"
			{...props}
		>
			{children}
		</th>
	),
	td: ({ children, ...props }) => (
		<td className="border border-border px-3 py-2" {...props}>
			{children}
		</td>
	),
	// Style horizontal rules
	hr: (props) => <hr className="my-4 border-border" {...props} />,
};

export function MarkdownRenderer({
	content,
	className = "",
	prose = true,
}: MarkdownRendererProps) {
	if (!content) return null;

	const baseClass = prose ? "prose prose-sm dark:prose-invert max-w-none" : "";

	return (
		<div className={`${baseClass} ${className}`}>
			<ReactMarkdown components={defaultComponents} remarkPlugins={[remarkGfm]}>
				{content}
			</ReactMarkdown>
		</div>
	);
}
