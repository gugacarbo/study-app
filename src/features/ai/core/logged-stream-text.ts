import { streamText } from "ai";
import type { D1Database } from "@cloudflare/workers-types";
import {
	type LlmLogContext,
	withStreamTextLogging,
} from "@/lib/llm-logging";

type StreamTextOptions = NonNullable<Parameters<typeof streamText>[0]>;

export function loggedStreamText(
	ctx: LlmLogContext,
	options: StreamTextOptions,
	db?: D1Database,
) {
	return streamText(withStreamTextLogging(options, ctx, db));
}
