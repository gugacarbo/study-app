import type { Question } from "@/lib/validation";
import type { DBQueries } from "../../../db/queries";
import { FileService } from "../../../lib/file-service";
import { sendStage } from "./sse-emitter";

interface PersistParams {
	queries: DBQueries;
	fileService: FileService;
	fileName: string;
	buffer: number[];
	questions: Question[];
	send: (event: string, data: unknown) => void;
	log: {
		error: (msg: string, err: unknown, ctx?: Record<string, unknown>) => void;
	};
}

export async function persistResults(
	params: PersistParams,
): Promise<{ examId: number; fileId: number }> {
	const { queries, fileService, fileName, buffer, questions, send, log } =
		params;

	sendStage(send, "persist", "Saving to database", "running");

	let examId: number;
	try {
		examId = await queries.insertExam(fileName, "upload");
	} catch (err) {
		log.error("Failed to insert exam", err, {
			stage: "persist",
			fileName,
			questionCount: questions.length,
		});
		sendStage(send, "persist", "Saving to database", "error", {
			error: err instanceof Error ? err.message : "unknown",
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
			sendStage(send, "persist", "Saving to database", "error", {
				error: err instanceof Error ? err.message : "unknown",
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
		sendStage(send, "persist", "Saving to database", "error", {
			error: err instanceof Error ? err.message : "unknown",
		});
		throw err;
	}

	sendStage(send, "persist", "Saving to database", "done");
	return { examId, fileId };
}
