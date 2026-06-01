import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { DBQueries, type FileInfo, type FileRecord } from "../db/queries";

export class FileService {
	private queries: DBQueries;
	private bucket: R2Bucket;

	constructor(d1: D1Database, bucket: R2Bucket) {
		this.queries = new DBQueries(d1);
		this.bucket = bucket;
	}

	/**
	 * Save an uploaded file linked to an exam.
	 * The buffer comes as number[] from the client (serialized Uint8Array).
	 * Returns the file ID.
	 */
	async save(
		examId: number,
		name: string,
		buffer: number[],
		mimeType?: string,
	): Promise<number> {
		const content = Buffer.from(buffer);
		const r2Key = this.buildR2Key(examId, name);

		await this.bucket.put(r2Key, content, {
			httpMetadata: mimeType ? { contentType: mimeType } : undefined,
		});

		return await this.queries.insertFile(
			examId,
			name,
			r2Key,
			content.length,
			mimeType,
		);
	}

	/**
	 * Retrieve a file by its ID (includes raw content).
	 */
	async get(id: number): Promise<FileRecord | null> {
		return await this.queries.getFile(id);
	}

	/**
	 * List all files for a given exam (metadata only, no content).
	 */
	async listByExam(examId: number): Promise<FileInfo[]> {
		return await this.queries.getFilesByExam(examId);
	}

	/**
	 * Delete a file by ID.
	 */
	async delete(id: number): Promise<void> {
		const file = await this.queries.getFile(id);
		if (file) {
			await this.bucket.delete(file.r2_key);
		}
		await this.queries.deleteFile(id);
	}

	private buildR2Key(examId: number, fileName: string): string {
		const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
		return `exam-${examId}/${Date.now()}-${safeFileName}`;
	}

	/**
	 * Infer a MIME type from a file name extension.
	 */
	static inferMimeType(fileName: string): string {
		const ext = fileName.split(".").pop()?.toLowerCase();
		switch (ext) {
			case "pdf":
				return "application/pdf";
			case "md":
				return "text/markdown";
			case "txt":
				return "text/plain";
			case "html":
			case "htm":
				return "text/html";
			case "json":
				return "application/json";
			case "csv":
				return "text/csv";
			default:
				return "application/octet-stream";
		}
	}
}
