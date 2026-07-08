import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import { type JobRow, listJobsPageForUser } from "@/db/queries/jobs";
import { requireDB } from "@/functions/db";
import {
	JOB_KIND,
	type JobKind,
	type JobStatus,
	parseGenerateExamJobMetadata,
	parseIngestJobMetadata,
} from "@/lib/job-kinds";
import { requireSession } from "@/lib/rbac";

export const USER_JOBS_PAGE_SIZE = 20;

export type UserJobListItem = {
	id: string;
	kind: JobKind;
	status: JobStatus;
	phase: string | null;
	title: string;
	error: string | null;
	createdAt: string | null;
	updatedAt: string | null;
};

export type UserJobsPageResult = {
	rows: UserJobListItem[];
	total: number;
	page: number;
	pageSize: number;
};

const listUserJobsSchema = z.object({
	page: z.number().int().positive().default(1),
	pageSize: z.number().int().positive().max(100).default(USER_JOBS_PAGE_SIZE),
});

function getJobTitle(job: JobRow): string {
	if (job.kind === JOB_KIND.INGEST) {
		return (
			parseIngestJobMetadata(job.metadata)?.fileName ?? "Importação de prova"
		);
	}

	if (job.kind === JOB_KIND.GENERATE_EXAM) {
		const metadata = parseGenerateExamJobMetadata(job.metadata);
		return metadata?.examId ? "Geração de prova" : "Geração de prova";
	}

	if (job.kind === JOB_KIND.IMPROVE_QUESTIONS) {
		return "Melhoria de questões";
	}

	if (job.kind === JOB_KIND.EXPLAIN_QUESTION) {
		return "Explicação de questão";
	}

	if (job.kind === JOB_KIND.CONNECTION_TEST) {
		return "Teste de conexão";
	}

	if (job.kind === JOB_KIND.MODEL_BENCHMARK) {
		return "Benchmark de modelo";
	}

	return `Job ${job.id.slice(0, 8)}`;
}

function toUserJobListItem(job: JobRow): UserJobListItem {
	return {
		id: job.id,
		kind: job.kind as JobKind,
		status: job.status as JobStatus,
		phase: job.phase,
		title: getJobTitle(job),
		error: job.error,
		createdAt: job.createdAt,
		updatedAt: job.updatedAt,
	};
}

export async function listUserJobsHandler(
	headers: Headers,
	input: z.input<typeof listUserJobsSchema>,
): Promise<UserJobsPageResult> {
	const data = listUserJobsSchema.parse(input);
	const session = await requireSession(headers);
	const db = createDb(await requireDB());
	const page = await listJobsPageForUser(
		db,
		session.user.id,
		data.page,
		data.pageSize,
	);

	return {
		rows: page.rows.map(toUserJobListItem),
		total: page.total,
		page: page.page,
		pageSize: page.pageSize,
	};
}

export const listUserJobs = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => listUserJobsSchema.parse(data))
	.handler(async ({ data }) => {
		return listUserJobsHandler(getRequest().headers, data);
	});
