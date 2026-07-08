import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GenerateExamForm } from "@/features/exams/components/generate-exam-form";

const navigate = vi.fn();
const submit = vi.fn();
const reset = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		useNavigate: () => navigate,
	};
});

vi.mock("@/features/exams/hooks/use-generate-exam-job", () => ({
	useGenerateExamJob: () => ({
		uiState: "idle",
		progress: 0,
		error: null,
		isBusy: false,
		submit,
		reset,
	}),
}));

describe("GenerateExamForm", () => {
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		navigate.mockClear();
		submit.mockReset();
		reset.mockReset();
	});

	it("renders all fields: title, mainContent, questionCount, difficulty, difficultyNotes, contextFiles", () => {
		render(<GenerateExamForm />);

		expect(screen.getByLabelText(/titulo/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/conteudo principal/i)).toBeInTheDocument();
		expect(
			screen.getByLabelText(/quantidade de questoes/i),
		).toBeInTheDocument();
		expect(screen.getByLabelText(/dificuldade/i)).toBeInTheDocument();
		expect(
			screen.getByLabelText(/instrucoes complementares/i),
		).toBeInTheDocument();
		expect(screen.getByLabelText(/arquivos de contexto/i)).toBeInTheDocument();
	});

	it("auto-suggests title from markdown heading in mainContent", () => {
		render(<GenerateExamForm />);

		const textarea = screen.getByLabelText(/conteudo principal/i);
		fireEvent.change(textarea, {
			target: { value: "# Introducao a Algebra\n\nConteudo basico." },
		});

		const titleInput = screen.getByLabelText(/titulo/i) as HTMLInputElement;
		expect(titleInput.value).toBe("Introducao a Algebra");
	});

	it("auto-suggests title from first non-empty line when no heading", () => {
		render(<GenerateExamForm />);

		const textarea = screen.getByLabelText(/conteudo principal/i);
		fireEvent.change(textarea, {
			target: {
				value: "Conceitos fundamentais de matematica.\n\nTexto adicional.",
			},
		});

		const titleInput = screen.getByLabelText(/titulo/i) as HTMLInputElement;
		expect(titleInput.value).toBe("Conceitos fundamentais de matematica.");
	});

	it("auto-suggests title from first attached filename when no mainContent", () => {
		render(<GenerateExamForm />);

		const fileInput = screen.getByLabelText(/arquivos de contexto/i);
		const file = new File(["conteudo"], "algebra-linear.md", {
			type: "text/markdown",
		});
		fireEvent.change(fileInput, { target: { files: [file] } });

		const titleInput = screen.getByLabelText(/titulo/i) as HTMLInputElement;
		expect(titleInput.value).toBe("Algebra linear");
	});

	it("falls back to empty title when no content or files", () => {
		render(<GenerateExamForm />);

		const titleInput = screen.getByLabelText(/titulo/i) as HTMLInputElement;
		expect(titleInput.value).toBe("");
	});

	it("stops auto-updating title after manual edit", () => {
		render(<GenerateExamForm />);

		const titleInput = screen.getByLabelText(/titulo/i) as HTMLInputElement;
		fireEvent.change(titleInput, { target: { value: "Meu titulo manual" } });

		const textarea = screen.getByLabelText(/conteudo principal/i);
		fireEvent.change(textarea, {
			target: { value: "# Titulo Sugerido\n\nConteudo." },
		});

		expect(titleInput.value).toBe("Meu titulo manual");
	});

	it("validates questionCount range (1-20)", () => {
		render(<GenerateExamForm />);

		const countInput = screen.getByLabelText(/quantidade de questoes/i);
		fireEvent.change(countInput, { target: { value: "0" } });

		const submitButton = screen.getByRole("button", {
			name: /gerar prova com ia/i,
		});
		fireEvent.click(submitButton);

		expect(
			screen.getByText(/escolha entre 1 e 20 questoes/i),
		).toBeInTheDocument();
	});

	it("validates context file extensions (.txt/.md only)", () => {
		render(<GenerateExamForm />);

		const fileInput = screen.getByLabelText(/arquivos de contexto/i);
		const file = new File(["data"], "dados.pdf", { type: "application/pdf" });
		fireEvent.change(fileInput, { target: { files: [file] } });

		const submitButton = screen.getByRole("button", {
			name: /gerar prova com ia/i,
		});
		fireEvent.click(submitButton);

		expect(
			screen.getByText(/anexe apenas arquivos .txt ou .md/i),
		).toBeInTheDocument();
	});

	it("validates max 5 context files", () => {
		render(<GenerateExamForm />);

		// jsdom does not support setting multiple files on a file input,
		// so we mock the files getter on the prototype
		const files = Array.from({ length: 6 }, (_, i) => {
			return new File([`conteudo ${i}`], `arquivo${i}.txt`, {
				type: "text/plain",
			});
		});

		const fileInput = screen.getByLabelText(/arquivos de contexto/i);
		vi.spyOn(fileInput, "files", "get").mockReturnValue(
			files as unknown as FileList,
		);
		fireEvent.change(fileInput);

		// Submit to trigger validation
		fireEvent.click(
			screen.getByRole("button", { name: /gerar prova com ia/i }),
		);

		expect(
			screen.getByText(/voce pode anexar ate 5 arquivos/i),
		).toBeInTheDocument();
	});

	it("shows validation errors when form is invalid (empty title and content)", () => {
		render(<GenerateExamForm />);

		const submitButton = screen.getByRole("button", {
			name: /gerar prova com ia/i,
		});
		expect(submitButton).not.toBeDisabled();

		fireEvent.click(submitButton);

		expect(
			screen.getByText(/informe um titulo para a prova/i),
		).toBeInTheDocument();
		expect(
			screen.getByText(/descreva o conteudo base da prova/i),
		).toBeInTheDocument();
	});

	it("enables submit when form is valid", async () => {
		render(<GenerateExamForm />);

		const textarea = screen.getByLabelText(/conteudo principal/i);
		fireEvent.change(textarea, {
			target: { value: "Conteudo valido para a prova." },
		});

		const titleInput = screen.getByLabelText(/titulo/i);
		fireEvent.change(titleInput, { target: { value: "Prova valida" } });

		const submitButton = screen.getByRole("button", {
			name: /gerar prova com ia/i,
		});
		expect(submitButton).not.toBeDisabled();
	});

	it("calls submit with form data on valid submission", async () => {
		submit.mockResolvedValue(true);

		render(<GenerateExamForm />);

		const textarea = screen.getByLabelText(/conteudo principal/i);
		fireEvent.change(textarea, {
			target: { value: "Conteudo valido para a prova." },
		});

		const titleInput = screen.getByLabelText(/titulo/i);
		fireEvent.change(titleInput, { target: { value: "Prova valida" } });

		await act(async () => {
			fireEvent.click(
				screen.getByRole("button", { name: /gerar prova com ia/i }),
			);
		});

		await waitFor(() => {
			expect(submit).toHaveBeenCalledWith(
				expect.objectContaining({
					title: "Prova valida",
					mainContent: "Conteudo valido para a prova.",
					questionCount: 10,
					difficulty: "medium",
				}),
			);
		});
	});
});
