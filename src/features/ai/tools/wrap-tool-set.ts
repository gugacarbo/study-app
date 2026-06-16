import type { ToolExecutionOptions, ToolSet } from "ai";

export type ToolExecutedEvent = {
	toolCallId: string;
	toolName: string;
	output: unknown;
};

type ExecutableTool = {
	execute?: (
		input: unknown,
		options?: ToolExecutionOptions,
	) => Promise<unknown> | unknown;
};

export function wrapToolSetWithExecutionHook(
	tools: ToolSet,
	onExecuted: (event: ToolExecutedEvent) => void | Promise<void>,
): ToolSet {
	const wrapped: ToolSet = {};

	for (const [toolName, toolDefinition] of Object.entries(tools)) {
		const executable = toolDefinition as ExecutableTool;
		if (!executable.execute) {
			wrapped[toolName] = toolDefinition;
			continue;
		}

		const execute = executable.execute;
		wrapped[toolName] = {
			...toolDefinition,
			execute: async (input, options) => {
				const output = await execute(input, options);
				const toolCallId = options?.toolCallId;
				if (toolCallId) {
					await onExecuted({ toolCallId, toolName, output });
				}
				return output;
			},
		};
	}

	return wrapped;
}
