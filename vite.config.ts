import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const config = defineConfig({
	resolve: {
		tsconfigPaths: true,
		dedupe: ["react", "react-dom"],
		alias: {
			react: path.resolve(rootDir, "node_modules/react"),
			"react-dom": path.resolve(rootDir, "node_modules/react-dom"),
		},
	},
	optimizeDeps: {
		include: [
			"react",
			"react/jsx-runtime",
			"react/jsx-dev-runtime",
			"react-dom",
			"react-dom/client",
			"@assistant-ui/react",
		],
	},
	// Pre-bundle React in the SSR (workerd) environment at startup so dep
	// discovery does not trigger mid-session re-optimizations with stale hashes.
	environments: {
		ssr: {
			optimizeDeps: {
				include: [
					"react",
					"react/jsx-runtime",
					"react/jsx-dev-runtime",
					"react-dom",
					"react-dom/server",
					"@tanstack/react-router > @tanstack/react-store",
				],
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
