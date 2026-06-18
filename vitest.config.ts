import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [react()],
	resolve: {
		tsconfigPaths: true,
		alias: {
			"cloudflare:workers": path.resolve(
				rootDir,
				"src/test/mocks/cloudflare-workers.ts",
			),
		},
	},
	test: {
		environment: "jsdom",
		setupFiles: ["./tests/setup.ts"],
		include: ["src/**/*.test.ts", "src/**/*.spec.tsx"],
		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			".old_app/**",
			"old_app/**",
			"tests/**",
		],
	},
});
