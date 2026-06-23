import { describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "@/db/client";
import * as examsQueries from "@/db/queries/exams";
import * as filesQueries from "@/db/queries/files";
import { INGEST_DATA_PART } from "@/features/ai/jobs/ingest/ingest-events";
import {
	type BackgroundJobRow,
	type RunIngestDeps,
	runIngest,
} from "@/features/ai/jobs/ingest/run-ingest";
import {
	FINISH_EXTRACTION_SUMMARY_MAX_LENGTH,
	finishExtractionInputSchema,
} from "@/features/ai/jobs/ingest/run-ingest/ingest-agent-tools";
import { JOB_ERROR_CODE } from "@/lib/job-errors";
import {
	INGEST_MODE,
	INGEST_PHASE,
	INGEST_WARNING,
	JOB_KIND,
	JOB_STATUS,
	serializeIngestJobMetadata,
} from "@/lib/job-kinds";
import * as llmLogging from "@/lib/llm-logging";
import * as r2Audit from "@/lib/r2-audit";

const jobId = "00000000-0000-4000-8000-000000000101";
const examId = "00000000-0000-4000-8000-000000000201";
const fileId = "00000000-0000-4000-8000-000000000301";
const userId = "00000000-0000-4000-8000-000000000401";
const modelId = "00000000-0000-4000-8000-000000000501";

function makeQuestion(index: number) {
	return {
		question: `Questão ${index}?`,
		options: [
			{ key: "A", text: "Opção A" },
			{ key: "B", text: "Opção B" },
		],
		answers: ["A"],
		topic: "Tópico",
	};
}

function makeJob(overrides?: Partial<BackgroundJobRow>): BackgroundJobRow {
	return {
		id: jobId,
		userId,
		kind: JOB_KIND.INGEST,
		status: JOB_STATUS.QUEUED,
		phase: null,
		error: null,
		metadata: serializeIngestJobMetadata({
			examId,
			fileId,
			fileName: "prova.md",
			modelId,
			mode: INGEST_MODE.CREATE,
		}),
		cancelRequestedAt: null,
		...overrides,
	};
}

function createMockStreamText(questions: unknown[]) {
	return vi.fn((_options) => {
		async function* streamParts() {
			yield {
				type: "start-step",
				request: {},
				warnings: [],
			};
			yield {
				type: "reasoning-delta",
				id: "reason-1",
				text: "Analisando a prova…",
			};
			yield {
				type: "reasoning-end",
				id: "reason-1",
			};

			for (const [index, question] of questions.entries()) {
				const toolCallId = `submit-${index}`;
				yield {
					type: "tool-call",
					toolCallId,
					toolName: "submit_question",
					input: question,
				};

				const execute = _options.tools?.submit_question?.execute;
				if (execute) {
					await execute(question, {
						toolCallId,
						messages: [],
						abortSignal: _options.abortSignal,
					});
				}
			}

			yield {
				type: "tool-call",
				toolCallId: "list-1",
				toolName: "list_questions",
				input: {},
			};

			const listExecute = _options.tools?.list_questions?.execute;
			if (listExecute) {
				await listExecute(
					{},
					{
						toolCallId: "list-1",
						messages: [],
						abortSignal: _options.abortSignal,
					},
				);
			}

			const summary = `${questions.length} questão(ões) extraída(s) da prova.`;
			yield {
				type: "tool-call",
				toolCallId: "finish-1",
				toolName: "finish_extraction",
				input: {
					total: questions.length,
					summary,
				},
			};

			const finishExecute = _options.tools?.finish_extraction?.execute;
			if (finishExecute) {
				await finishExecute(
					{
						total: questions.length,
						summary,
					},
					{
						toolCallId: "finish-1",
						messages: [],
						abortSignal: _options.abortSignal,
					},
				);
			}

			yield {
				type: "finish-step",
				response: {},
				usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
				finishReason: "tool-calls",
				rawFinishReason: "tool_calls",
				providerMetadata: undefined,
			};
			yield {
				type: "finish",
				finishReason: "stop",
				rawFinishReason: "stop",
				totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
			};
		}

		return { fullStream: streamParts() };
	}) as unknown as RunIngestDeps["streamText"];
}

function createMockReviewStreamText(
	updater?: (question: ReturnType<typeof makeQuestion>) => ReturnType<typeof makeQuestion>,
) {
	return vi.fn((_options) => {
		async function* streamParts() {
			yield {
				type: "start-step",
				request: {},
				warnings: [],
			};
			yield {
				type: "reasoning-delta",
				id: "reason-1",
				text: "Revisando as questões…",
			};
			yield {
				type: "reasoning-end",
				id: "reason-1",
			};

			yield {
				type: "tool-call",
				toolCallId: "list-review-1",
				toolName: "list_questions",
				input: {},
			};

			const listExecute = _options.tools?.list_questions?.execute;
			const listResult = listExecute
				? await listExecute(
						{},
						{
							toolCallId: "list-review-1",
							messages: [],
							abortSignal: _options.abortSignal,
						},
					)
				: undefined;

			const questions = Array.isArray(listResult?.questions)
				? listResult.questions
				: [];

			for (const question of questions) {
				const nextQuestion = updater ? updater(question) : question;
				yield {
					type: "tool-call",
					toolCallId: `update-${question.draftQuestionId}`,
					toolName: "update_question",
					input: {
						draftQuestionId: question.draftQuestionId,
						question: nextQuestion.question,
						options: nextQuestion.options,
						answers: nextQuestion.answers,
						topic: nextQuestion.topic,
					},
				};

				const updateExecute = _options.tools?.update_question?.execute;
				if (updateExecute) {
					await updateExecute(
						{
							draftQuestionId: question.draftQuestionId,
							question: nextQuestion.question,
							options: nextQuestion.options,
							answers: nextQuestion.answers,
							topic: nextQuestion.topic,
						},
						{
							toolCallId: `update-${question.draftQuestionId}`,
							messages: [],
							abortSignal: _options.abortSignal,
						},
					);
				}
			}

			yield {
				type: "tool-call",
				toolCallId: "list-review-2",
				toolName: "list_questions",
				input: {},
			};

			if (listExecute) {
				await listExecute(
					{},
					{
						toolCallId: "list-review-2",
						messages: [],
						abortSignal: _options.abortSignal,
					},
				);
			}

			yield {
				type: "tool-call",
				toolCallId: "finish-review-1",
				toolName: "finish_review",
				input: {
					total: questions.length,
					summary: "Revisão concluída.",
				},
			};

			const finishExecute = _options.tools?.finish_review?.execute;
			if (finishExecute) {
				await finishExecute(
					{
						total: questions.length,
						summary: "Revisão concluída.",
					},
					{
						toolCallId: "finish-review-1",
						messages: [],
						abortSignal: _options.abortSignal,
					},
				);
			}

			yield {
				type: "finish-step",
				response: {},
				usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
				finishReason: "tool-calls",
				rawFinishReason: "tool_calls",
				providerMetadata: undefined,
			};
			yield {
				type: "finish",
				finishReason: "stop",
				rawFinishReason: "stop",
				totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
			};
		}

		return { fullStream: streamParts() };
	}) as unknown as RunIngestDeps["streamText"];
}

function createRunDeps(input?: {
	questions?: unknown[];
	getAiModel?: RunIngestDeps["getAiModel"];
	streamText?: RunIngestDeps["streamText"];
	reviewStreamText?: RunIngestDeps["streamText"];
	generateObject?: RunIngestDeps["generateObject"];
	persistQuestionsDeps?: RunIngestDeps["persistQuestionsDeps"];
}): {
	deps: RunIngestDeps;
	updateJobStatus: ReturnType<typeof vi.fn>;
	appendJobEvent: ReturnType<typeof vi.fn>;
} {
	const updateJobStatus = vi.fn(async () => undefined);
	const appendJobEvent = vi.fn(async () => undefined);
	const getJobById = vi.fn(async () => makeJob());
	const isCancelRequested = vi.fn(async () => false);
	const questions = input?.questions ?? [makeQuestion(1)];

	const generateObject =
		input?.generateObject ??
		(vi.fn(async () => ({
			object: { questions },
		})) as unknown as RunIngestDeps["generateObject"]);

	const streamText =
		input?.streamText ?? createMockStreamText(questions);

	const getAiModel =
		input?.getAiModel ?? vi.fn(async () => ({ modelId: "gpt-4o" }) as never);

	const persistQuestionsDeps = input?.persistQuestionsDeps ?? {
		existsNormalizedQuestion: vi.fn(async () => false),
		batchInsertQuestions: vi.fn(async () => undefined),
	};

	return {
		deps: {
			getJobById,
			updateJobStatus,
			appendJobEvent,
			isCancelRequested,
			getAiModel,
			generateObject,
			streamText,
			reviewStreamText: input?.reviewStreamText,
			sleep: vi.fn(async () => undefined),
			persistQuestionsDeps,
		},
		updateJobStatus,
		appendJobEvent,
	};
}

describe("runIngest", () => {
	it("requires finish_extraction summary with max 400 chars and optional alerts", () => {
		expect(
			finishExtractionInputSchema.safeParse({
				total: 3,
				summary: "Resumo curto da extração",
				alerts: ["Questão 4 exigiu revisão manual."],
			}).success,
		).toBe(true);

		expect(
			finishExtractionInputSchema.safeParse({
				total: 3,
				summary: "",
			}).success,
		).toBe(false);

		expect(
			finishExtractionInputSchema.safeParse({
				total: 3,
				summary: "a".repeat(FINISH_EXTRACTION_SUMMARY_MAX_LENGTH + 1),
			}).success,
		).toBe(false);
	});

	it("no-ops when job status is not queued", async () => {
		const updateJobStatus = vi.fn(async () => undefined);
		const deps: RunIngestDeps = {
			getJobById: vi.fn(async () => makeJob({ status: JOB_STATUS.RUNNING })),
			updateJobStatus,
			appendJobEvent: vi.fn(async () => undefined),
			isCancelRequested: vi.fn(async () => false),
			persistQuestionsDeps: {
				existsNormalizedQuestion: vi.fn(async () => false),
				batchInsertQuestions: vi.fn(async () => undefined),
			},
		};

		await runIngest({
			jobId,
			db: {} as AppDatabase,
			filesBucket: {} as never,
			deps,
		});

		expect(updateJobStatus).not.toHaveBeenCalled();
	});

	it("fails with no_valid_questions when LLM returns zero questions", async () => {
		const { deps, updateJobStatus } = createRunDeps({ questions: [] });

		vi.spyOn(examsQueries, "getExamById").mockResolvedValue({
			id: examId,
			userId,
			name: "Prova",
			source: "prova.md",
			createdAt: null,
		});
		vi.spyOn(filesQueries, "getFileByIdWithOwnership").mockResolvedValue({
			id: fileId,
			examId,
			name: "prova.md",
			r2Key: "users/user/files/prova.md",
			mimeType: "text/markdown",
			size: 10,
			ttlSeconds: 0,
			createdAt: null,
		});
		vi.spyOn(r2Audit, "auditedR2Get").mockResolvedValue({
			arrayBuffer: async () => new TextEncoder().encode("conteúdo").buffer,
		} as never);
		vi.spyOn(llmLogging, "logLlmCallStart").mockResolvedValue(undefined);
		vi.spyOn(llmLogging, "logLlmCallComplete").mockResolvedValue(undefined);

		await runIngest({
			jobId,
			db: {} as AppDatabase,
			filesBucket: {} as never,
			deps,
		});

		expect(updateJobStatus).toHaveBeenCalledWith(
			jobId,
			expect.objectContaining({
				status: JOB_STATUS.FAILED,
				error: JOB_ERROR_CODE.NO_VALID_QUESTIONS,
			}),
		);
	});

	it("fails with model_unavailable when getAiModel throws", async () => {
		const { deps, updateJobStatus } = createRunDeps({
			getAiModel: vi.fn(async () => {
				throw new Error("Modelo de IA desabilitado");
			}),
		});

		vi.spyOn(examsQueries, "getExamById").mockResolvedValue({
			id: examId,
			userId,
			name: "Prova",
			source: "prova.md",
			createdAt: null,
		});
		vi.spyOn(filesQueries, "getFileByIdWithOwnership").mockResolvedValue({
			id: fileId,
			examId,
			name: "prova.md",
			r2Key: "users/user/files/prova.md",
			mimeType: "text/markdown",
			size: 10,
			ttlSeconds: 0,
			createdAt: null,
		});
		vi.spyOn(r2Audit, "auditedR2Get").mockResolvedValue({
			arrayBuffer: async () => new TextEncoder().encode("conteúdo").buffer,
		} as never);

		await runIngest({
			jobId,
			db: {} as AppDatabase,
			filesBucket: {} as never,
			deps,
		});

		expect(updateJobStatus).toHaveBeenCalledWith(
			jobId,
			expect.objectContaining({
				status: JOB_STATUS.FAILED,
				error: JOB_ERROR_CODE.MODEL_UNAVAILABLE,
			}),
		);
	});

	it("completes when agent rejects invalid submit_question payloads", async () => {
		const { deps, updateJobStatus } = createRunDeps({
			questions: [
				makeQuestion(1),
				{
					question: "",
					options: [{ key: "A", text: "A" }],
					answers: ["A"],
					topic: "Inválida",
				},
			],
		});

		vi.spyOn(examsQueries, "getExamById").mockResolvedValue({
			id: examId,
			userId,
			name: "Prova",
			source: "prova.md",
			createdAt: null,
		});
		vi.spyOn(filesQueries, "getFileByIdWithOwnership").mockResolvedValue({
			id: fileId,
			examId,
			name: "prova.md",
			r2Key: "users/user/files/prova.md",
			mimeType: "text/markdown",
			size: 10,
			ttlSeconds: 0,
			createdAt: null,
		});
		vi.spyOn(r2Audit, "auditedR2Get").mockResolvedValue({
			arrayBuffer: async () => new TextEncoder().encode("conteúdo").buffer,
		} as never);
		vi.spyOn(llmLogging, "logLlmCallStart").mockResolvedValue(undefined);
		vi.spyOn(llmLogging, "logLlmCallComplete").mockResolvedValue(undefined);

		await runIngest({
			jobId,
			db: {} as AppDatabase,
			filesBucket: {} as never,
			deps,
		});

		expect(updateJobStatus).toHaveBeenCalledWith(
			jobId,
			expect.objectContaining({
				status: JOB_STATUS.COMPLETED,
				metadata: expect.stringContaining('"persistedCount":1'),
			}),
		);
		expect(updateJobStatus).not.toHaveBeenCalledWith(
			jobId,
			expect.objectContaining({
				metadata: expect.stringContaining(INGEST_WARNING.PARTIAL_EXTRACTION),
			}),
		);
	});

	it("emits ingest phase and progress events", async () => {
		const fileContent = "conteúdo";
		const { deps, appendJobEvent } = createRunDeps({
			questions: [makeQuestion(1), makeQuestion(2)],
		});

		vi.spyOn(examsQueries, "getExamById").mockResolvedValue({
			id: examId,
			userId,
			name: "Prova",
			source: "prova.md",
			createdAt: null,
		});
		vi.spyOn(filesQueries, "getFileByIdWithOwnership").mockResolvedValue({
			id: fileId,
			examId,
			name: "prova.md",
			r2Key: "users/user/files/prova.md",
			mimeType: "text/markdown",
			size: 10,
			ttlSeconds: 0,
			createdAt: null,
		});
		vi.spyOn(r2Audit, "auditedR2Get").mockResolvedValue({
			arrayBuffer: async () => new TextEncoder().encode(fileContent).buffer,
		} as never);
		vi.spyOn(llmLogging, "logLlmCallStart").mockResolvedValue(undefined);
		vi.spyOn(llmLogging, "logLlmCallComplete").mockResolvedValue(undefined);

		await runIngest({
			jobId,
			db: {} as AppDatabase,
			filesBucket: {} as never,
			deps,
		});

		const payloads = appendJobEvent.mock.calls.map((call) =>
			JSON.parse(call[1]),
		);
		expect(payloads).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: INGEST_DATA_PART.PHASE,
					data: { phase: INGEST_PHASE.READING_FILE },
				}),
				expect.objectContaining({
					type: "data-ingest-system-info",
					data: expect.objectContaining({
						kind: "file-read",
						payload: { charCount: 8 },
					}),
				}),
				expect.objectContaining({
					type: INGEST_DATA_PART.PHASE,
					data: { phase: INGEST_PHASE.EXTRACTING },
				}),
				expect.objectContaining({
					type: INGEST_DATA_PART.PHASE,
					data: { phase: INGEST_PHASE.REVIEWING },
				}),
				expect.objectContaining({
					type: "data-ingest-system-info",
					data: expect.objectContaining({
						kind: "llm-call",
					}),
				}),
				expect.objectContaining({
					type: INGEST_DATA_PART.STREAM_PROGRESS,
				}),
				expect.objectContaining({
					type: INGEST_DATA_PART.PHASE,
					data: { phase: INGEST_PHASE.PERSISTING },
				}),
				expect.objectContaining({
					type: "data-ingest-system-info",
					data: expect.objectContaining({
						kind: "persist-validating",
						payload: { total: 2 },
					}),
				}),
				expect.objectContaining({
					type: INGEST_DATA_PART.PERSIST_PROGRESS,
					data: { saved: 2, total: 2 },
				}),
				expect.objectContaining({
					type: "data-ingest-system-info",
					data: expect.objectContaining({
						kind: "persist-progress",
					}),
				}),
				expect.objectContaining({
					type: INGEST_DATA_PART.SUMMARY,
				}),
			]),
		);
	});

	it("emits llm retry text events on transient failures", async () => {
		const agentStream = createMockStreamText([makeQuestion(1)]);
		let callCount = 0;
		const streamText = vi.fn((options) => {
			callCount += 1;
			if (callCount === 1) {
				throw Object.assign(new Error("503"), { status: 503 });
			}
			return agentStream!(options);
		}) as unknown as RunIngestDeps["streamText"];

		const { deps, appendJobEvent } = createRunDeps({ streamText });

		vi.spyOn(examsQueries, "getExamById").mockResolvedValue({
			id: examId,
			userId,
			name: "Prova",
			source: "prova.md",
			createdAt: null,
		});
		vi.spyOn(filesQueries, "getFileByIdWithOwnership").mockResolvedValue({
			id: fileId,
			examId,
			name: "prova.md",
			r2Key: "users/user/files/prova.md",
			mimeType: "text/markdown",
			size: 10,
			ttlSeconds: 0,
			createdAt: null,
		});
		vi.spyOn(r2Audit, "auditedR2Get").mockResolvedValue({
			arrayBuffer: async () => new TextEncoder().encode("conteúdo").buffer,
		} as never);
		vi.spyOn(llmLogging, "logLlmCallStart").mockResolvedValue(undefined);
		vi.spyOn(llmLogging, "logLlmCallComplete").mockResolvedValue(undefined);

		await runIngest({
			jobId,
			db: {} as AppDatabase,
			filesBucket: {} as never,
			deps,
		});

		const textPayloads = appendJobEvent.mock.calls
			.map((call) => JSON.parse(call[1]))
			.filter((payload) => payload.type === "data-ingest-system-info");

		expect(textPayloads).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "data-ingest-system-info",
					data: expect.objectContaining({
						kind: "llm-call",
					}),
				}),
				expect.objectContaining({
					type: "data-ingest-system-info",
					data: expect.objectContaining({
						kind: "llm-retry",
						payload: { attempt: 2, maxAttempts: 3 },
					}),
				}),
			]),
		);
	});

	it("cancels before running when cancel was requested while queued", async () => {
		const { deps, updateJobStatus } = createRunDeps();
		deps.isCancelRequested = vi.fn(async () => true);

		vi.spyOn(examsQueries, "getExamById").mockResolvedValue({
			id: examId,
			userId,
			name: "Prova",
			source: "prova.md",
			createdAt: null,
		});

		await runIngest({
			jobId,
			db: {} as AppDatabase,
			filesBucket: {} as never,
			deps,
		});

		expect(updateJobStatus).toHaveBeenCalledWith(jobId, {
			status: JOB_STATUS.CANCELLED,
			error: null,
		});
		expect(updateJobStatus).not.toHaveBeenCalledWith(
			jobId,
			expect.objectContaining({ status: JOB_STATUS.RUNNING }),
		);
	});

	it("cancels before LLM extraction when cancel is requested", async () => {
		const isCancelRequested = vi.fn(async () => true);

		const streamText = vi.fn(
			createMockStreamText([makeQuestion(1)]),
		) as unknown as RunIngestDeps["streamText"];

		const updateJobStatus = vi.fn(async () => undefined);
		const appendJobEvent = vi.fn(async () => undefined);
		const deps: RunIngestDeps = {
			getJobById: vi.fn(async () => makeJob()),
			updateJobStatus,
			appendJobEvent,
			isCancelRequested,
			getAiModel: vi.fn(async () => ({ modelId: "gpt-4o" }) as never),
			generateObject: vi.fn(async () => ({
				object: { questions: [makeQuestion(1)] },
			})) as unknown as RunIngestDeps["generateObject"],
			streamText,
			sleep: vi.fn(async () => undefined),
			persistQuestionsDeps: {
				existsNormalizedQuestion: vi.fn(async () => false),
				batchInsertQuestions: vi.fn(async () => undefined),
			},
		};

		vi.spyOn(examsQueries, "getExamById").mockResolvedValue({
			id: examId,
			userId,
			name: "Prova",
			source: "prova.md",
			createdAt: null,
		});
		vi.spyOn(filesQueries, "getFileByIdWithOwnership").mockResolvedValue({
			id: fileId,
			examId,
			name: "prova.md",
			r2Key: "users/user/files/prova.md",
			mimeType: "text/markdown",
			size: 10,
			ttlSeconds: 0,
			createdAt: null,
		});
		vi.spyOn(r2Audit, "auditedR2Get").mockResolvedValue({
			arrayBuffer: async () => new TextEncoder().encode("conteúdo").buffer,
		} as never);
		vi.spyOn(llmLogging, "logLlmCallStart").mockResolvedValue(undefined);
		vi.spyOn(llmLogging, "logLlmCallComplete").mockResolvedValue(undefined);

		await runIngest({
			jobId,
			db: {} as AppDatabase,
			filesBucket: {} as never,
			deps,
		});

		expect(streamText).not.toHaveBeenCalled();
		expect(updateJobStatus).toHaveBeenCalledWith(jobId, {
			status: JOB_STATUS.CANCELLED,
			error: null,
		});
	});

	it("persists agent stream parts during extraction", async () => {
		const questions = [makeQuestion(1), makeQuestion(2)];
		const { deps, appendJobEvent } = createRunDeps({
			questions,
			streamText: createMockStreamText(questions),
		});

		vi.spyOn(examsQueries, "getExamById").mockResolvedValue({
			id: examId,
			userId,
			name: "Prova",
			source: "prova.md",
			createdAt: null,
		});
		vi.spyOn(filesQueries, "getFileByIdWithOwnership").mockResolvedValue({
			id: fileId,
			examId,
			name: "prova.md",
			r2Key: "users/user/files/prova.md",
			mimeType: "text/markdown",
			size: 10,
			ttlSeconds: 0,
			createdAt: null,
		});
		vi.spyOn(r2Audit, "auditedR2Get").mockResolvedValue({
			arrayBuffer: async () => new TextEncoder().encode("conteúdo").buffer,
		} as never);
		vi.spyOn(llmLogging, "logLlmCallStart").mockResolvedValue(undefined);
		vi.spyOn(llmLogging, "logLlmCallComplete").mockResolvedValue(undefined);

		await runIngest({
			jobId,
			db: {} as AppDatabase,
			filesBucket: {} as never,
			deps,
		});

		const payloads = appendJobEvent.mock.calls.map((call) =>
			JSON.parse(call[1]),
		);

		expect(payloads).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "reasoning-delta",
					messageId: "ingest-step-1",
					delta: "Analisando a prova…",
				}),
				expect.objectContaining({
					type: "reasoning",
					messageId: "ingest-step-1",
					text: "Analisando a prova…",
				}),
				expect.objectContaining({
					type: "tool-call",
					messageId: "ingest-step-1",
					toolName: "submit_question",
					state: "running",
				}),
				expect.objectContaining({
					type: "tool-result",
					messageId: "ingest-step-1",
					result: {
						ok: true,
						index: 1,
						draftQuestionId: "draft-1",
					},
				}),
				expect.objectContaining({
					type: "tool-result",
					messageId: "ingest-step-1",
					result: {
						ok: true,
						index: 2,
						draftQuestionId: "draft-2",
					},
				}),
				expect.objectContaining({
					type: "tool-call",
					messageId: "ingest-step-1",
					toolName: "list_questions",
					argsText: JSON.stringify({}),
					state: "running",
				}),
				expect.objectContaining({
					type: "tool-result",
					messageId: "ingest-step-1",
					result: {
						ok: true,
						total: 2,
						questions,
					},
				}),
				expect.objectContaining({
					type: "tool-call",
					messageId: "ingest-step-1",
					toolName: "finish_extraction",
					argsText: JSON.stringify({
						total: 2,
						summary: "2 questão(ões) extraída(s) da prova.",
					}),
					state: "running",
				}),
				expect.objectContaining({
					type: "tool-result",
					messageId: "ingest-step-1",
					result: {
						ok: true,
						total: 2,
						summary: "2 questão(ões) extraída(s) da prova.",
						verified: true,
					},
				}),
				{
					type: "text",
					text: "2 questão(ões) extraída(s) da prova.",
				},
			]),
		);
	});

	it("persists reviewed questions when the review agent succeeds", async () => {
		const batchInsertQuestions = vi.fn(async () => undefined);
		const reviewedQuestion = {
			question: "Qual é a capital?",
			options: [
				{ key: "B", text: "B) Brasília" },
				{ key: "A", text: "A) São Paulo" },
			],
			answers: ["B"],
			topic: "Geografia",
		};
		const { deps, updateJobStatus } = createRunDeps({
			questions: [makeQuestion(1)],
			streamText: createMockStreamText([makeQuestion(1)]),
			reviewStreamText: createMockReviewStreamText(() => reviewedQuestion),
			persistQuestionsDeps: {
				existsNormalizedQuestion: vi.fn(async () => false),
				batchInsertQuestions,
			},
		});

		vi.spyOn(examsQueries, "getExamById").mockResolvedValue({
			id: examId,
			userId,
			name: "Prova",
			source: "prova.md",
			createdAt: null,
		});
		vi.spyOn(filesQueries, "getFileByIdWithOwnership").mockResolvedValue({
			id: fileId,
			examId,
			name: "prova.md",
			r2Key: "users/user/files/prova.md",
			mimeType: "text/markdown",
			size: 10,
			ttlSeconds: 0,
			createdAt: null,
		});
		vi.spyOn(r2Audit, "auditedR2Get").mockResolvedValue({
			arrayBuffer: async () => new TextEncoder().encode("conteúdo").buffer,
		} as never);
		vi.spyOn(llmLogging, "logLlmCallStart").mockResolvedValue(undefined);
		vi.spyOn(llmLogging, "logLlmCallComplete").mockResolvedValue(undefined);

		await runIngest({
			jobId,
			db: {} as AppDatabase,
			filesBucket: {} as never,
			deps,
		});

		expect(batchInsertQuestions).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					question: "Qual é a capital?",
					options: JSON.stringify([
						{ key: "A", text: "Brasília" },
						{ key: "B", text: "São Paulo" },
					]),
					answers: JSON.stringify(["A"]),
					topic: "Geografia",
				}),
			]),
		);
		expect(updateJobStatus).toHaveBeenCalledWith(
			jobId,
			expect.objectContaining({
				status: JOB_STATUS.COMPLETED,
				metadata: expect.stringContaining('"reviewedCount":1'),
			}),
		);
	});

	it("falls back to raw extracted questions when review fails", async () => {
		const batchInsertQuestions = vi.fn(async () => undefined);
		const reviewStreamText = vi.fn(() => {
			throw new Error("review_failed");
		}) as unknown as RunIngestDeps["streamText"];
		const { deps, appendJobEvent, updateJobStatus } = createRunDeps({
			questions: [makeQuestion(1)],
			streamText: createMockStreamText([makeQuestion(1)]),
			reviewStreamText,
			persistQuestionsDeps: {
				existsNormalizedQuestion: vi.fn(async () => false),
				batchInsertQuestions,
			},
		});

		vi.spyOn(examsQueries, "getExamById").mockResolvedValue({
			id: examId,
			userId,
			name: "Prova",
			source: "prova.md",
			createdAt: null,
		});
		vi.spyOn(filesQueries, "getFileByIdWithOwnership").mockResolvedValue({
			id: fileId,
			examId,
			name: "prova.md",
			r2Key: "users/user/files/prova.md",
			mimeType: "text/markdown",
			size: 10,
			ttlSeconds: 0,
			createdAt: null,
		});
		vi.spyOn(r2Audit, "auditedR2Get").mockResolvedValue({
			arrayBuffer: async () => new TextEncoder().encode("conteúdo").buffer,
		} as never);
		vi.spyOn(llmLogging, "logLlmCallStart").mockResolvedValue(undefined);
		vi.spyOn(llmLogging, "logLlmCallComplete").mockResolvedValue(undefined);

		await runIngest({
			jobId,
			db: {} as AppDatabase,
			filesBucket: {} as never,
			deps,
		});

		expect(batchInsertQuestions).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					question: "Questão 1?",
					options: JSON.stringify(makeQuestion(1).options),
				}),
			]),
		);
		expect(appendJobEvent).toHaveBeenCalledWith(
			jobId,
			expect.stringContaining("Revisão automática indisponível; salvando extração original."),
		);
		expect(updateJobStatus).toHaveBeenCalledWith(
			jobId,
			expect.objectContaining({
				status: JOB_STATUS.COMPLETED,
				metadata: expect.stringContaining('"reviewWarning":"review_fallback"'),
			}),
		);
	});
});
