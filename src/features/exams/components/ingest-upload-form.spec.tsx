import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IngestUploadForm } from "@/features/exams/components/ingest-upload-form";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		useNavigate: () => navigate,
	};
});

describe("IngestUploadForm", () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		navigate.mockClear();
	});

	it("disables submit without file", () => {
		render(<IngestUploadForm />);
		const submit = screen.getByRole("button", { name: /importar prova/i });
		expect(submit).toBeDisabled();
	});

	it("does not show exam name or model fields", () => {
		render(<IngestUploadForm />);
		expect(screen.queryByLabelText(/nome da prova/i)).not.toBeInTheDocument();
		expect(screen.queryByLabelText(/modelo/i)).not.toBeInTheDocument();
	});

	it("navigates to job monitor with pendingFile after create", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValueOnce({
				ok: true,
				json: async () => ({ jobId: "job-1", examId: "exam-1" }),
			}),
		);

		render(<IngestUploadForm />);

		const file = new File(["conteúdo"], "prova.md", { type: "text/markdown" });
		fireEvent.change(screen.getByLabelText(/^arquivo$/i), {
			target: { files: [file] },
		});

		fireEvent.click(screen.getByRole("button", { name: /importar prova/i }));

		await waitFor(() => {
			expect(navigate).toHaveBeenCalledWith({
				to: "/jobs/$jobId",
				params: { jobId: "job-1" },
				state: { pendingFile: file },
			});
		});
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it("displays error when job creation fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: async () => ({ error: "internal_error" }),
			}),
		);

		render(<IngestUploadForm />);

		const file = new File(["conteúdo"], "prova.md", { type: "text/markdown" });
		fireEvent.change(screen.getByLabelText(/^arquivo$/i), {
			target: { files: [file] },
		});

		fireEvent.click(screen.getByRole("button", { name: /importar prova/i }));

		await waitFor(() => {
			expect(screen.getByRole("alert")).toBeInTheDocument();
		});
		expect(navigate).not.toHaveBeenCalled();
	});
});
