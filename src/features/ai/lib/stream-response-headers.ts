/**
 * Shared response headers for UI Message Stream endpoints on Cloudflare Workers.
 * `content-encoding: identity` avoids Workers compressing/buffering the SSE body.
 */
const UI_MESSAGE_STREAM_RESPONSE_HEADERS = {
	"content-encoding": "identity",
	"cache-control": "no-cache, no-transform",
} as const satisfies Record<string, string>;

export function mergeStreamResponseHeaders(headers?: HeadersInit): HeadersInit {
	return {
		...UI_MESSAGE_STREAM_RESPONSE_HEADERS,
		...(headers ?? {}),
	};
}
