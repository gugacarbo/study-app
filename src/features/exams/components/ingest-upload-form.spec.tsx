import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IngestUploadForm } from "@/features/exams/components/ingest-upload-form";

describe("IngestUploadForm", () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
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

	it("displays 413 error when upload exceeds size limit", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ jobId: "job-1", examId: "exam-1" }),
				})
				.mockResolvedValueOnce({
					ok: false,
					status: 413,
					json: async () => ({
						error: "file_too_large",
						maxBytes: 524_288,
					}),
				}),
		);

		render(<IngestUploadForm />);

		const file = new File(["conteúdo"], "prova.md", { type: "text/markdown" });
		fireEvent.change(screen.getByLabelText(/^arquivo$/i), {
			target: { files: [file] },
		});

		fireEvent.click(screen.getByRole("button", { name: /importar prova/i }));

		await waitFor(() => {
			expect(screen.getByRole("alert")).toHaveTextContent(/512 KB/i);
		});
	});
});
