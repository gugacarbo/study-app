import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserJobsTable } from "@/features/background-processes/components/user-jobs-table";
import { JOB_KIND, JOB_STATUS } from "@/lib/job-kinds";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		to,
		params,
		children,
	}: {
		to: string;
		params?: { jobId?: string };
		children: React.ReactNode;
	}) => <a href={params?.jobId ? `/jobs/${params.jobId}` : to}>{children}</a>,
}));

describe("UserJobsTable", () => {
	afterEach(() => {
		cleanup();
	});

	it("renders an empty state when the user has no jobs", () => {
		render(
			<UserJobsTable
				jobs={[]}
				page={1}
				pageSize={20}
				total={0}
				onPageChange={vi.fn()}
			/>,
		);

		expect(screen.getByText("Nenhum job encontrado.")).toBeInTheDocument();
		expect(screen.getByText("0 resultados")).toBeInTheDocument();
	});

	it("renders job rows with a link to the monitor and paginates", () => {
		const onPageChange = vi.fn();
		render(
			<UserJobsTable
				jobs={[
					{
						id: "job-1",
						kind: JOB_KIND.INGEST,
						status: JOB_STATUS.RUNNING,
						phase: "extracting",
						title: "prova-1.txt",
						error: null,
						createdAt: "2026-07-01T10:00:00.000Z",
						updatedAt: "2026-07-01T10:05:00.000Z",
					},
				]}
				page={2}
				pageSize={1}
				total={3}
				onPageChange={onPageChange}
			/>,
		);

		expect(screen.getByText("prova-1.txt")).toBeInTheDocument();
		expect(screen.getByText("Ingestão")).toBeInTheDocument();
		expect(screen.getByText("Em execução")).toBeInTheDocument();
		expect(screen.getByText("2–2 de 3")).toBeInTheDocument();
		expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /abrir/i })).toHaveAttribute(
			"href",
			"/jobs/job-1",
		);

		const previousButton = screen.getByRole("button", { name: /^anterior$/i });
		const nextButton = screen.getByRole("button", { name: /^próxima$/i });
		expect(previousButton).not.toBeDisabled();
		expect(nextButton).not.toBeDisabled();

		fireEvent.click(nextButton);
		expect(onPageChange).toHaveBeenCalledWith(3);
	});
});
