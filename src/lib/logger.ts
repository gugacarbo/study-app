import type { D1Database } from "@cloudflare/workers-types";
import { env } from "../env";

export interface Logger {
	info(message: string, data?: Record<string, unknown>): void;
	warn(message: string, data?: Record<string, unknown>): void;
	error(message: string, error?: unknown, data?: Record<string, unknown>): void;
}

interface ErrorDetails {
	name: string;
	message: string;
	stack?: string;
}

function extractError(error: unknown): ErrorDetails {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
		};
	}
	return {
		name: typeof error,
		message: String(error ?? "unknown"),
	};
}

function timestamp(): string {
	return new Date().toISOString();
}

function safeStringify(value: unknown): string {
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

export function createIngestLogger(module: string, db?: D1Database): Logger {
	return {
		info(message, data) {
			console.log(
				`[${timestamp()}] [INFO] [${module}] ${message}`,
				data ? safeStringify(data) : "",
			);
		},

		warn(message, data) {
			console.warn(
				`[${timestamp()}] [WARN] [${module}] ${message}`,
				data ? safeStringify(data) : "",
			);
		},

		error(message, error, data) {
			const err = extractError(error);

			console.error(
				`[${timestamp()} ERROR ${module}] ${message}`,
				`error=${err.name}: ${err.message}`,
				data ? safeStringify(data) : "",
			);

			if (db && env.AI_LOG_LLM === "true") {
				import("../db/queries")
					.then(({ DBQueries }) => {
						const queries = new DBQueries(db);
						return queries.insertLLMLog({
							callId: `ingest-err-${module}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
							callType: `ingest.${module}`,
							provider: "system",
							model: "system",
							status: "failed",
							errorMessage: `${message}: ${err.message}`,
							responsePayload: safeStringify({
								error: err,
								context: data ?? null,
							}),
							durationMs: 0,
						});
					})
					.catch((e) =>
						console.error(
							`[${timestamp()} ERROR logger] Failed to persist error to D1:`,
							e,
						),
					);
			}
		},
	};
}
