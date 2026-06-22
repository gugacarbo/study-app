#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_PORT = process.env.LOCALFLARE_PORT ?? "8787";
const LOCALFLARE_ATTACH_PORT = process.env.LOCALFLARE_ATTACH_PORT ?? "8788";
const DASHBOARD_PORT = process.env.LOCALFLARE_DASHBOARD_PORT ?? "5174";
const APP_URL = `http://127.0.0.1:${APP_PORT}/login`;
const API_HEALTH_URL = `http://127.0.0.1:${LOCALFLARE_ATTACH_PORT}/__localflare/health`;
const DASHBOARD_URL = `http://127.0.0.1:${DASHBOARD_PORT}?port=${LOCALFLARE_ATTACH_PORT}`;
const viteBin = path.join(rootDir, "node_modules/vite/bin/vite.js");
const localflareBin = path.join(rootDir, "node_modules/localflare/dist/index.js");
const wranglerConfig = path.join(rootDir, "wrangler.jsonc");
const persistDir = path.join(rootDir, ".wrangler/state");
const dashboardDistDir = path.join(rootDir, "node_modules/localflare-dashboard/dist");

const MIME_TYPES = {
	".css": "text/css; charset=utf-8",
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".svg": "image/svg+xml",
	".woff2": "font/woff2",
};

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

async function waitForUrl(url, timeoutMs = 120_000) {
	const started = Date.now();

	while (Date.now() - started < timeoutMs) {
		try {
			const response = await fetch(url);
			if (response.ok) {
				return;
			}
		} catch {
			// Service is still starting.
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error(`Timed out waiting for ${url}.`);
}

function startDashboardServer() {
	return new Promise((resolve, reject) => {
		const server = createServer((request, response) => {
			const requestPath = request.url?.split("?")[0] ?? "/";
			const relativePath = requestPath === "/" ? "/index.html" : requestPath;
			const filePath = path.join(dashboardDistDir, relativePath);
			const resolvedPath = path.resolve(filePath);

			if (!resolvedPath.startsWith(dashboardDistDir)) {
				response.writeHead(403);
				response.end("Forbidden");
				return;
			}

			if (!existsSync(resolvedPath)) {
				response.writeHead(404);
				response.end("Not found");
				return;
			}

			const extension = path.extname(resolvedPath);
			response.writeHead(200, {
				"Content-Type": MIME_TYPES[extension] ?? "application/octet-stream",
			});
			response.end(readFileSync(resolvedPath));
		});

		server.on("error", reject);
		server.listen(Number(DASHBOARD_PORT), "127.0.0.1", () => resolve(server));
	});
}

async function openDashboard() {
	if (process.env.LOCALFLARE_NO_OPEN === "1") {
		return;
	}

	const platform = process.platform;
	const command =
		platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";

	spawn(command, [DASHBOARD_URL], {
		cwd: rootDir,
		stdio: "ignore",
		shell: platform === "win32",
	});
}

if (!existsSync(viteBin)) {
	console.error("[localflare-dev] vite not found. Run `pnpm install` first.");
	process.exit(1);
}

if (!existsSync(localflareBin)) {
	console.error("[localflare-dev] localflare not found. Run `pnpm install` first.");
	process.exit(1);
}

if (!existsSync(dashboardDistDir)) {
	console.error(
		"[localflare-dev] localflare-dashboard not found. Run `pnpm install` first.",
	);
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
let dashboardServer;

function stopAll(code = 0) {
	dashboardServer?.close();
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
	await waitForUrl(APP_URL);
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
	wranglerConfig,
	"--port",
	String(LOCALFLARE_ATTACH_PORT),
	"--no-open",
	"--persist-to",
	persistDir,
]);

localflareProcess.on("exit", (code) => {
	stopAll(code ?? 0);
});

try {
	await waitForUrl(API_HEALTH_URL);
} catch (error) {
	console.error(`[localflare-dev] ${error.message}`);
	stopAll(1);
}

try {
	console.log(`[localflare-dev] Starting dashboard on :${DASHBOARD_PORT}...`);
	dashboardServer = await startDashboardServer();
	await waitForUrl(`http://127.0.0.1:${DASHBOARD_PORT}/`);
} catch (error) {
	console.error(`[localflare-dev] Failed to start dashboard: ${error.message}`);
	stopAll(1);
}

console.log("");
console.log("[localflare-dev] Ready");
console.log(`  App:       http://127.0.0.1:${APP_PORT}/`);
console.log(`  API:       http://127.0.0.1:${LOCALFLARE_ATTACH_PORT}/__localflare/*`);
console.log(`  Dashboard: ${DASHBOARD_URL}`);
console.log("");
console.log(
	"[localflare-dev] Dashboard runs locally to avoid browser blocks on studio.localflare.dev.",
);
console.log("");

await openDashboard();
