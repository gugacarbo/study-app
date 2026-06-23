import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionEditForm } from "@/features/exams/components/question-edit-form";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";

const baseQuestion: QuestionDetail = {
	id: "q1",
	question: "Qual a capital do Brasil?",
	options: [
		{ key: "A", text: "São Paulo" },
		{ key: "B", text: "Brasília" },
		{ key: "C", text: "Rio de Janeiro" },
	],
	answers: ["B"],
	topic: "Geografia",
	scoringMode: "exact",
	explanation: "Explicação curta",
	deepExplanation: "Explicação longa",
};

const partialQuestion: QuestionDetail = {
	...baseQuestion,
	id: "q2",
	scoringMode: "partial",
	answers: ["A", "C"],
};

describe("QuestionEditForm", () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("renders all editable fields with current values", () => {
		render(
			<QuestionEditForm
				question={baseQuestion}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);

		expect(screen.getByDisplayValue("Qual a capital do Brasil?")).toBeInTheDocument();
		expect(screen.getByDisplayValue("Geografia")).toBeInTheDocument();
		expect(screen.getByDisplayValue("Explicação curta")).toBeInTheDocument();
		expect(screen.getByDisplayValue("Explicação longa")).toBeInTheDocument();
		expect(screen.getByText("a)")).toBeInTheDocument();
		expect(screen.getByText("b)")).toBeInTheDocument();
		expect(screen.getByText("c)")).toBeInTheDocument();
	});

	it("uses radio buttons in exact mode for correct answer selection", () => {
		render(
			<QuestionEditForm
				question={baseQuestion}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);

		const radios = screen.getAllByRole("radio");
		expect(radios).toHaveLength(3);
	});

	it("uses checkboxes in partial mode for correct answer selection", () => {
		render(
			<QuestionEditForm
				question={partialQuestion}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);

		const checkboxes = screen.getAllByRole("checkbox");
		expect(checkboxes).toHaveLength(3);
	});

	it("submits updated data", async () => {
		const onSubmit = vi.fn();
		render(
			<QuestionEditForm
				question={baseQuestion}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
			/>,
		);

		fireEvent.change(screen.getByDisplayValue("Qual a capital do Brasil?"), {
			target: { value: "Nova pergunta?" },
		});
		fireEvent.change(screen.getByDisplayValue("Geografia"), {
			target: { value: "História" },
		});

		fireEvent.click(screen.getAllByRole("button", { name: /salvar/i })[0]);

		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledOnce();
		});

		const submitted = onSubmit.mock.calls[0][0];
		expect(submitted.question).toBe("Nova pergunta?");
		expect(submitted.topic).toBe("História");
		expect(submitted.answers).toEqual(["B"]);
	});

	it("calls onCancel when cancel button is clicked", () => {
		const onCancel = vi.fn();
		render(
			<QuestionEditForm
				question={baseQuestion}
				onSubmit={vi.fn()}
				onCancel={onCancel}
			/>,
		);

		fireEvent.click(screen.getAllByRole("button", { name: /cancelar/i })[0]);

		expect(onCancel).toHaveBeenCalledOnce();
	});

	it("adds a new option when add button is clicked", () => {
		render(
			<QuestionEditForm
				question={baseQuestion}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);

		fireEvent.click(
			screen.getAllByRole("button", { name: /adicionar/i })[0],
		);

		expect(screen.getByText("d)")).toBeInTheDocument();
	});

	it("removes an option and clears its answer selection", () => {
		render(
			<QuestionEditForm
				question={baseQuestion}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
			/>,
		);

		const removeButtons = screen.getAllByRole("button", { name: /remover alternativa/i });
		expect(removeButtons).toHaveLength(3);

		fireEvent.click(removeButtons[0]);

		expect(screen.queryByText("a)")).not.toBeInTheDocument();
		expect(screen.getByText("b)")).toBeInTheDocument();
		expect(screen.getByText("c)")).toBeInTheDocument();
	});

	it("selects a single answer via radio in exact mode", async () => {
		const onSubmit = vi.fn();
		render(
			<QuestionEditForm
				question={baseQuestion}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
			/>,
		);

		const radios = screen.getAllByRole("radio");
		fireEvent.click(radios[0]);

		fireEvent.click(screen.getAllByRole("button", { name: /salvar/i })[0]);

		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledOnce();
		});

		const submitted = onSubmit.mock.calls[0][0];
		expect(submitted.answers).toEqual(["A"]);
	});

	it("prevents submission when required fields are empty", async () => {
		const onSubmit = vi.fn();
		render(
			<QuestionEditForm
				question={baseQuestion}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
			/>,
		);

		fireEvent.change(screen.getByDisplayValue("Qual a capital do Brasil?"), {
			target: { value: "" },
		});

		fireEvent.click(screen.getAllByRole("button", { name: /salvar/i })[0]);

		await waitFor(() => {
			expect(screen.getByText(/obrigatório/i)).toBeInTheDocument();
		});

		expect(onSubmit).not.toHaveBeenCalled();
	});
});