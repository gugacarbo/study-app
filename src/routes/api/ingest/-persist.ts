import type { Question } from "@/lib/validation";
import {
	writeStage,
	type JobUIMessageStreamWriter,
} from "@/features/ai/core/ui-message-job-stream";
import type { DBQueries } from "../../../db/queries";
import { FileService } from "../../../lib/file-service";

interface PersistParams {
	queries: DBQueries;
	fileService: FileService;
	fileName: string;
	examName: string;
	buffer: number[];
	questions: Question[];
	writer: JobUIMessageStreamWriter;
	log: {
		error: (msg: string, err: unknown, ctx?: Record<string, unknown>) => void;
	};
}

export async function persistResults(
	params: PersistParams,
): Promise<{ examId: number; fileId: number }> {
	const { queries, fileService, fileName, examName, buffer, questions, writer, log } =
		params;

	writeStage(writer, {
		stageId: "persist",
		label: "Saving to database",
		status: "running",
		timestamp: Date.now(),
	});

	let examId: number;
	try {
		examId = await queries.insertExam(examName, "upload");
	} catch (err) {
		log.error("Failed to insert exam", err, {
			stage: "persist",
			fileName,
			questionCount: questions.length,
		});
		writeStage(writer, {
			stageId: "persist",
			label: "Saving to database",
			status: "error",
			timestamp: Date.now(),
			meta: { error: err instanceof Error ? err.message : "unknown" },
		});
		throw err;
	}

	if (questions.length > 0) {
		try {
			await queries.insertQuestions(examId, questions);
		} catch (err) {
			log.error("Failed to insert questions", err, {
				stage: "persist",
				examId,
				questionCount: questions.length,
			});
			writeStage(writer, {
				stageId: "persist",
				label: "Saving to database",
				status: "error",
				timestamp: Date.now(),
				meta: { error: err instanceof Error ? err.message : "unknown" },
			});
			throw err;
		}
	}

	const mimeType = FileService.inferMimeType(fileName);
	let fileId: number;
	try {
		fileId = await fileService.save(examId, fileName, buffer, mimeType);
	} catch (err) {
		log.error("Failed to save file", err, {
			stage: "persist",
			examId,
			fileName,
			mimeType,
			bufferSize: buffer.length,
		});
		writeStage(writer, {
			stageId: "persist",
			label: "Saving to database",
			status: "error",
			timestamp: Date.now(),
			meta: { error: err instanceof Error ? err.message : "unknown" },
		});
		throw err;
	}

	writeStage(writer, {
		stageId: "persist",
		label: "Saving to database",
		status: "done",
		timestamp: Date.now(),
	});
	return { examId, fileId };
}
