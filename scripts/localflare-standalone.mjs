#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distConfig = path.join(rootDir, "dist/server/wrangler.json");
const persistDir = path.join(rootDir, ".wrangler/state");
const LOCALFLARE_PORT = process.env.LOCALFLARE_PORT ?? "8787";
const authUrl = `http://localhost:${LOCALFLARE_PORT}`;
const args = process.argv.slice(2);

function run(command, commandArgs, { exit = true } = {}) {
	const result = spawnSync(command, commandArgs, {
		cwd: rootDir,
		stdio: "inherit",
		shell: true,
	});
	if (exit) {
		process.exit(result.status ?? 1);
	}
	return result.status ?? 1;
}

if (!existsSync(distConfig)) {
	console.log(
		"[localflare] TanStack Start needs a built worker — running pnpm build…",
	);
	run("pnpm", ["run", "build"]);
}

console.log("[localflare] Applying D1 migrations to .wrangler/state…");
run("pnpm", ["run", "db:migrate"], { exit: false });

console.log(
	`[localflare] Using dist/server/wrangler.json on :${LOCALFLARE_PORT} (BETTER_AUTH_URL=${authUrl})`,
);
run("pnpm", [
	"exec",
	"localflare",
	distConfig,
	"--port",
	LOCALFLARE_PORT,
	"--persist-to",
	persistDir,
	...args,
	"--",
	"--var",
	`BETTER_AUTH_URL:${authUrl}`,
]);
