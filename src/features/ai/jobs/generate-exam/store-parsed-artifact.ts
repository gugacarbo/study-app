import type { R2Bucket } from "@cloudflare/workers-types";
import { buildFileR2Key, createId } from "@/db/queries/helpers";
import { type AuditedR2Context, auditedR2Put } from "@/lib/r2-audit";
import type { ParsedContextDocument } from "./parser-schema";

export type StoreParsedArtifactResult =
	| { ok: true; artifactFileId: string; r2Key: string }
	| { ok: false; error: string };

type R2BucketLike = R2Bucket;

export type StoreParsedArtifactDeps = {
	putArtifact: (
		key: string,
		body: string,
		options?: object,
	) => Promise<StoreParsedArtifactResult>;
};

function buildArtifactKey(userId: string, artifactFileId: string): string {
	return buildFileR2Key(userId, artifactFileId, "parsed-artifact.json");
}

export function buildStoreParsedArtifactDeps(
	filesBucket: R2BucketLike,
	userId: string,
): StoreParsedArtifactDeps {
	const auditContext: AuditedR2Context = {
		userId,
		bucketName: "FILES_BUCKET",
	};

	return {
		async putArtifact(key, body, options) {
			await auditedR2Put(filesBucket, auditContext, key, body, options);
			return { ok: true, artifactFileId: "", r2Key: key };
		},
	};
}

export async function storeParsedArtifact(
	filesBucket: R2BucketLike,
	userId: string,
	document: ParsedContextDocument,
): Promise<StoreParsedArtifactResult> {
	const artifactFileId = createId();
	const r2Key = buildArtifactKey(userId, artifactFileId);
	const body = JSON.stringify({
		schemaVersion: document.schemaVersion,
		sourceFileId: document.sourceFileId,
		title: document.title,
		documentType: document.documentType,
		summary: document.summary,
		rawText: document.rawText,
		sections: document.sections,
		topics: document.topics,
		facts: document.facts,
		studyObjectives: document.studyObjectives,
		glossary: document.glossary,
		warnings: document.warnings,
	});

	try {
		await auditedR2Put(
			filesBucket,
			{ userId, bucketName: "FILES_BUCKET" },
			r2Key,
			body,
			{
				httpMetadata: {
					contentType: "application/json; charset=utf-8",
				},
			},
		);
		return { ok: true, artifactFileId, r2Key };
	} catch (error) {
		return {
			ok: false,
			error:
				error instanceof Error
					? error.message
					: "Falha ao persistir artefato parseado",
		};
	}
}
