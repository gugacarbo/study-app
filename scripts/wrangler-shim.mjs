#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function runNodeScript(scriptPath, scriptArgs) {
	const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
		cwd: rootDir,
		stdio: "inherit",
		env: process.env,
	});
	process.exit(result.status ?? 1);
}

if (args[0] === "dev" && !args.includes("--config")) {
	console.warn(
		"[study-app] TanStack Start needs Vite for virtual modules — running `vite dev --port 3000` instead of `wrangler dev`.",
	);
	console.warn("[study-app] Use `npm run dev` next time.\n");

	const viteBin = path.join(rootDir, "node_modules/vite/bin/vite.js");
	if (!existsSync(viteBin)) {
		console.error("[study-app] vite not found. Run `pnpm install` first.");
		process.exit(1);
	}

	const passthrough = args.slice(1).filter((arg) => arg !== "dev");
	runNodeScript(viteBin, ["dev", "--port", "3000", ...passthrough]);
}

const wranglerBin = path.join(rootDir, "node_modules/wrangler/bin/wrangler.js");
if (!existsSync(wranglerBin)) {
	console.error("[study-app] wrangler not found. Run `pnpm install` first.");
	process.exit(1);
}

runNodeScript(wranglerBin, args);
