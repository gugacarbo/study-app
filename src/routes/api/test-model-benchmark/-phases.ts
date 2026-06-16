import type { BenchmarkPhaseId } from "@/features/ai/lib/benchmark-phase-validation";

export type PhaseDefinition = {
	id: BenchmarkPhaseId;
	label: string;
	system: string;
	userMsg: string;
	useTools: boolean;
	progressStart: number;
	progressEnd: number;
};

export const BENCHMARK_TEXT_SYSTEM = `You are a model benchmark assistant.

Rules:
- Reply in plain text only.
- Be concise: no preamble, no closing remark, no markdown code fences.
- Do not emit reasoning or thinking tags in the visible answer.
- After completing the task, call report_agent_stage_status once with status success and a brief outcome message.`;

export const BENCHMARK_TOOL_SYSTEM = `You are a model benchmark assistant.

When a task requires a tool:
1. Call the named tool exactly once with the arguments given in the user message.
2. Wait for the tool result before sending your final answer.
3. Do not call the same tool again.
4. After the tool result is delivered, reply immediately with your final answer in the exact format requested.
5. Do not ask follow-up questions or make additional tool calls after the result.
6. Follow the user's output format exactly (plain text only, no markdown fences, no reasoning tags).
7. After your final answer, call report_agent_stage_status once with status success and a brief outcome message.`;

export const BENCHMARK_STAGE_ID = "model-benchmark";

export const BENCHMARK_PHASES: PhaseDefinition[] = [
	{
		id: "text_baseline",
		label: "Text baseline",
		system: BENCHMARK_TEXT_SYSTEM,
		userMsg:
			'Write exactly one short English sentence. The sentence must contain the word "ready" (any capitalization). Example: I am ready.',
		useTools: false,
		progressStart: 10,
		progressEnd: 25,
	},
	{
		id: "tool_math",
		label: "Tool math",
		system: BENCHMARK_TOOL_SYSTEM,
		userMsg: `Task:
1. Call add_numbers once with a=17 and b=25.
2. After the tool returns, reply with only the numeric sum.

Required final answer (exactly this, no other characters):
42`,
		useTools: true,
		progressStart: 30,
		progressEnd: 50,
	},
	{
		id: "tool_echo",
		label: "Tool echo",
		system: BENCHMARK_TOOL_SYSTEM,
		userMsg: `Task:
1. Call echo once with message exactly: benchmark
2. After the tool returns, reply with one short sentence that includes the word benchmark.

Example final answer: The tool echoed benchmark.`,
		useTools: true,
		progressStart: 55,
		progressEnd: 75,
	},
	{
		id: "sustained_text",
		label: "Sustained text",
		system: `${BENCHMARK_TEXT_SYSTEM}

When asked for a list, use markdown bullets (- ) with one bullet per line. No title or summary before or after the list.`,
		userMsg: `Write exactly 4 bullet points about LLM latency and throughput.

Format (4 lines, each starting with "- "):
- first point
- second point
- third point
- fourth point

Do not add any other lines.`,
		useTools: false,
		progressStart: 80,
		progressEnd: 95,
	},
];
