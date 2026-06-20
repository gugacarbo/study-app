#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_PORT = process.env.LOCALFLARE_PORT ?? "8787";
const LOCALFLARE_ATTACH_PORT = process.env.LOCALFLARE_ATTACH_PORT ?? "8788";
const APP_URL = `http://127.0.0.1:${APP_PORT}/login`;
const viteBin = path.join(rootDir, "node_modules/vite/bin/vite.js");
const localflareBin = path.join(rootDir, "node_modules/localflare/dist/index.js");
const persistDir = path.join(rootDir, ".wrangler/state");

function createPrefixedWriter(prefix, stream) {
	let buffer = "";
	return (chunk) => {
		buffer += chunk.toString();
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			stream.write(`${prefix} ${line}\n`);
		}
	};
}

function spawnLogged(label, command, args, env = process.env) {
	const child = spawn(command, args, {
		cwd: rootDir,
		env,
		stdio: ["inherit", "pipe", "pipe"],
	});

	const writeStdout = createPrefixedWriter(`[${label}]`, process.stdout);
	const writeStderr = createPrefixedWriter(`[${label}]`, process.stderr);

	child.stdout?.on("data", writeStdout);
	child.stderr?.on("data", writeStderr);

	return child;
}

async function waitForApp(timeoutMs = 120_000) {
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

	throw new Error(`Timed out waiting for the app at ${APP_URL}.`);
}

if (!existsSync(viteBin)) {
	console.error("[localflare-dev] vite not found. Run `pnpm install` first.");
	process.exit(1);
}

if (!existsSync(localflareBin)) {
	console.error("[localflare-dev] localflare not found. Run `pnpm install` first.");
	process.exit(1);
}

const devEnv = {
	...process.env,
	// Avoid ENOSPC watcher failures on large workspaces.
	CHOKIDAR_USEPOLLING: process.env.CHOKIDAR_USEPOLLING ?? "1",
};

console.log(`[localflare-dev] Starting Vite on :${APP_PORT}...`);
const viteProcess = spawnLogged("app", process.execPath, [
	viteBin,
	"dev",
	"--port",
	String(APP_PORT),
], devEnv);

let localflareProcess;

function stopAll(code = 0) {
	localflareProcess?.kill("SIGTERM");
	viteProcess?.kill("SIGTERM");
	process.exit(code);
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

viteProcess.on("exit", (code, signal) => {
	if (signal) {
		stopAll(1);
		return;
	}
	if (code && code !== 0) {
		console.error(`[localflare-dev] Vite exited with code ${code}`);
		stopAll(code);
	}
});

try {
	await waitForApp();
} catch (error) {
	console.error(`[localflare-dev] ${error.message}`);
	stopAll(1);
}

console.log(
	`[localflare-dev] Starting Localflare attach on :${LOCALFLARE_ATTACH_PORT}...`,
);
localflareProcess = spawnLogged("localflare", process.execPath, [
	localflareBin,
	"attach",
	"--port",
	String(LOCALFLARE_ATTACH_PORT),
	"--no-open",
	"--persist-to",
	persistDir,
]);

localflareProcess.on("exit", (code) => {
	stopAll(code ?? 0);
});
