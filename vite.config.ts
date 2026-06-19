import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Pre-bundle at dev startup so lazy routes do not trigger mid-session
// re-optimizations (browser keeps stale ?v= hashes → 504 Outdated Optimize Dep).
const clientOptimizeDeps = [
	"react",
	"react/jsx-runtime",
	"react/jsx-dev-runtime",
	"react-dom",
	"react-dom/client",
	"react-hook-form",
	"@hookform/resolvers/zod",
	"@tanstack/react-query",
	"@tanstack/react-router",
	"@tanstack/react-router > @tanstack/react-store",
	"ai",
	"@ai-sdk/openai",
	"zod",
];

const ssrOptimizeDeps = [...clientOptimizeDeps, "react-dom/server"];

const optimizeDepsDefaults = {
	holdUntilCrawlEnd: true,
	// Serve the latest optimized chunk when the browser still has a stale ?v= hash.
	ignoreOutdatedRequests: true,
} as const;

const config = defineConfig({
	resolve: {
		tsconfigPaths: true,
		dedupe: ["react", "react-dom", "zod"],
		alias: {
			react: path.resolve(rootDir, "node_modules/react"),
			"react-dom": path.resolve(rootDir, "node_modules/react-dom"),
		},
	},
	optimizeDeps: {
		...optimizeDepsDefaults,
		include: clientOptimizeDeps,
	},
	environments: {
		ssr: {
			optimizeDeps: {
				...optimizeDepsDefaults,
				include: ssrOptimizeDeps,
				// zod v4 splits into chunks the SSR optimizer cannot resolve reliably.
				exclude: ["zod"],
			},
		},
	},
	server: {
		strictPort: true,
		watch: {
			ignored: [
				"**/.git/**",
				"**/node_modules/**",
				"**/dist/**",
				"**/.agents/**",
				"**/migrations/**",
			],
		},
	},
	plugins: [
		devtools(),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
});

export default config;
