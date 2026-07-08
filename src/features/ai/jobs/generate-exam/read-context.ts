import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import * as schema from "@/db/schema";
import { JOB_ERROR_CODE, type JobErrorBody } from "@/lib/job-errors";
import type { GenerateExamJobMetadata, GenerateExamRawContext } from "./types";

export type ReadContextResult =
	| { ok: true; context: GenerateExamRawContext }
	| { ok: false; terminal: JobErrorBody };

type R2ObjectLike = {
	size: number;
	arrayBuffer(): Promise<ArrayBuffer>;
};

type R2BucketLike = {
	get(key: string): Promise<R2ObjectLike | null> | R2ObjectLike | null;
};

type ReadContextDeps = {
	getR2Object: (key: string) => Promise<R2ObjectLike | null>;
};

const textDecoder = new TextDecoder("utf-8", { fatal: false });

async function readTextFromR2(
	deps: ReadContextDeps,
	key: string,
): Promise<string | null> {
	const object = await deps.getR2Object(key);
	if (!object) return null;
	const buffer = await object.arrayBuffer();
	return textDecoder.decode(buffer);
}

function r2KeyNotFoundError(fileId: string): JobErrorBody {
	return {
		error: JOB_ERROR_CODE.EXAM_NOT_FOUND,
		message: `Arquivo de contexto não encontrado no storage: ${fileId}`,
	};
}

function emptyFileError(fileId: string): JobErrorBody {
	return {
		error: JOB_ERROR_CODE.EMPTY_FILE,
		message: `Arquivo de contexto está vazio: ${fileId}`,
	};
}

export function buildReadContextDeps(
	filesBucket: R2BucketLike,
	userId: string,
): ReadContextDeps {
	return {
		async getR2Object(key: string): Promise<R2ObjectLike | null> {
			return await filesBucket.get(key);
		},
	};
}

export async function readGenerateExamContext(
	db: AppDatabase,
	metadata: GenerateExamJobMetadata,
	userId: string,
	filesBucket: R2BucketLike,
): Promise<ReadContextResult> {
	const deps = buildReadContextDeps(filesBucket, userId);
	return readGenerateExamContextWithDeps(db, metadata, userId, deps);
}

export async function readGenerateExamContextWithDeps(
	db: AppDatabase,
	metadata: GenerateExamJobMetadata,
	userId: string,
	deps: ReadContextDeps,
): Promise<ReadContextResult> {
	const fileRows = await db
		.select({
			id: schema.files.id,
			name: schema.files.name,
			r2Key: schema.files.r2Key,
			examId: schema.files.examId,
		})
		.from(schema.files)
		.innerJoin(schema.exams, eq(schema.files.examId, schema.exams.id))
		.where(
			and(
				eq(schema.exams.userId, userId),
				eq(schema.files.examId, metadata.examId),
			),
		)
		.orderBy(schema.files.createdAt);

	let mainContentFileId: string | null = null;
	let mainContent: string | null = null;

	const contextFiles: GenerateExamRawContext["contextFiles"] = [];

	for (const row of fileRows) {
		const text = await readTextFromR2(deps, row.r2Key);
		if (text == null) {
			return { ok: false, terminal: r2KeyNotFoundError(row.id) };
		}
		if (text.trim().length === 0) {
			return { ok: false, terminal: emptyFileError(row.id) };
		}

		if (row.name === "conteudo-base.md") {
			if (mainContent == null) {
				mainContentFileId = row.id;
				mainContent = text;
			}
		} else {
			contextFiles.push({
				fileId: row.id,
				fileName: row.name,
				text,
			});
		}
	}

	if (mainContent == null || mainContentFileId == null) {
		return {
			ok: false,
			terminal: {
				error: JOB_ERROR_CODE.EMPTY_FILE,
				message: "conteudo-base.md não encontrado ou vazio.",
			},
		};
	}

	return {
		ok: true,
		context: {
			mainContentFileId,
			mainContent,
			contextFiles,
		},
	};
}
