#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_PORT = 3000;
const LOCALFLARE_ATTACH_PORT = 8788;
const APP_URL = `http://127.0.0.1:${APP_PORT}/login`;

async function waitForApp(timeoutMs = 90_000) {
	const started = Date.now();

	while (Date.now() - started < timeoutMs) {
		try {
			const response = await fetch(APP_URL);
			if (response.ok) {
				return;
			}
		} catch {
			// Vite is still starting.
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error(
		`Timed out waiting for the app at ${APP_URL}. Start it with "pnpm dev" first.`,
	);
}

async function isAppRunning() {
	try {
		const response = await fetch(APP_URL);
		return response.ok;
	} catch {
		return false;
	}
}

function run(command, args, options = {}) {
	return spawn(command, args, {
		cwd: rootDir,
		stdio: "inherit",
		shell: true,
		...options,
	});
}

let viteProcess;
let localflareProcess;

function shutdown(code = 0) {
	localflareProcess?.kill("SIGTERM");
	viteProcess?.kill("SIGTERM");
	process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

if (!(await isAppRunning())) {
	console.log(`[localflare-dev] Starting Vite on :${APP_PORT}...`);
	viteProcess = run("pnpm", ["exec", "vite", "dev", "--port", String(APP_PORT)]);
	await waitForApp();
} else {
	console.log(`[localflare-dev] Reusing Vite on :${APP_PORT}`);
}

const persistDir = path.join(rootDir, ".wrangler/state");

console.log(
	`[localflare-dev] Starting Localflare attach on :${LOCALFLARE_ATTACH_PORT}...`,
);
localflareProcess = run("pnpm", [
	"exec",
	"localflare",
	"attach",
	"--port",
	String(LOCALFLARE_ATTACH_PORT),
	"--no-open",
	"--persist-to",
	persistDir,
]);

localflareProcess.on("close", (code) => {
	viteProcess?.kill("SIGTERM");
	process.exit(code ?? 0);
});
