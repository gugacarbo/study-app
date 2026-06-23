import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IngestUploadForm } from "@/features/exams/components/ingest-upload-form";

const navigate = vi.fn();
const createIngestJob = vi.fn();
const uploadIngestJobFileWithProgress = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		useNavigate: () => navigate,
	};
});

vi.mock("@/features/exams/lib/ingest-api", () => ({
	createIngestJob: () => createIngestJob(),
	uploadIngestJobFileWithProgress: (
		jobId: string,
		file: File,
		onProgress: (percent: number) => void,
	) => uploadIngestJobFileWithProgress(jobId, file, onProgress),
}));

describe("IngestUploadForm", () => {
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		navigate.mockClear();
		createIngestJob.mockReset();
		uploadIngestJobFileWithProgress.mockReset();
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
		createIngestJob.mockResolvedValueOnce({ jobId: "job-1", examId: "exam-1" });
		uploadIngestJobFileWithProgress.mockResolvedValueOnce(undefined);

		render(<IngestUploadForm />);

		const file = new File(["conteúdo"], "prova.md", { type: "text/markdown" });
		fireEvent.change(screen.getByLabelText(/^arquivo$/i), {
			target: { files: [file] },
		});

		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /importar prova/i }));
		});

		await waitFor(() => {
			expect(navigate).toHaveBeenCalledWith({
				to: "/jobs/$jobId",
				params: { jobId: "job-1" },
			});
		}, { timeout: 2000 });
		expect(uploadIngestJobFileWithProgress).toHaveBeenCalledWith(
			"job-1",
			file,
			expect.any(Function),
		);
	});

	it("displays error when job creation fails", async () => {
		createIngestJob.mockRejectedValueOnce(new Error("Erro HTTP 500"));

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

	it("shows upload progress on the form screen before navigating", async () => {
		createIngestJob.mockResolvedValueOnce({ jobId: "job-1", examId: "exam-1" });
		uploadIngestJobFileWithProgress.mockImplementationOnce(
			async (_jobId: string, _file: File, onProgress: (percent: number) => void) => {
				onProgress(42);
			},
		);

		render(<IngestUploadForm />);

		const file = new File(["conteúdo"], "prova.md", { type: "text/markdown" });
		fireEvent.change(screen.getByLabelText(/^arquivo$/i), {
			target: { files: [file] },
		});

		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /importar prova/i }));
		});

		expect(screen.getByText(/enviando… 42%/i)).toBeInTheDocument();
		expect(screen.getByRole("progressbar", { name: /progresso do envio/i })).toBeInTheDocument();

		await waitFor(() => {
			expect(navigate).toHaveBeenCalledWith({
				to: "/jobs/$jobId",
				params: { jobId: "job-1" },
			});
		}, { timeout: 2000 });
	});

	it("keeps upload progress visible for at least 1 second before navigating", async () => {
		vi.useFakeTimers();
		createIngestJob.mockResolvedValueOnce({ jobId: "job-1", examId: "exam-1" });
		uploadIngestJobFileWithProgress.mockImplementationOnce(
			async (_jobId: string, _file: File, onProgress: (percent: number) => void) => {
				onProgress(100);
			},
		);

		render(<IngestUploadForm />);

		const file = new File(["conteúdo"], "prova.md", { type: "text/markdown" });
		fireEvent.change(screen.getByLabelText(/^arquivo$/i), {
			target: { files: [file] },
		});

		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /importar prova/i }));
		});

		expect(screen.getByText(/enviando… 100%/i)).toBeInTheDocument();
		expect(navigate).not.toHaveBeenCalled();

		await act(async () => {
			vi.advanceTimersByTime(999);
		});
		expect(navigate).not.toHaveBeenCalled();

		await act(async () => {
			vi.advanceTimersByTime(1);
		});

		expect(navigate).toHaveBeenCalledWith({
			to: "/jobs/$jobId",
			params: { jobId: "job-1" },
		});
	});
});
