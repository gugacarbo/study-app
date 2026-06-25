import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuizConfigForm } from "@/features/quiz/components/quiz-config-form";
import type { QuizConfig } from "@/features/quiz/types/quiz";

describe("QuizConfigForm", () => {
	const defaultConfig: QuizConfig = {
		order: "original",
		quantity: 10,
		topicFilter: null,
		revealMode: "after",
	};

	afterEach(() => {
		cleanup();
	});

	it("submits default values when topics are provided", () => {
		const onSubmit = vi.fn();
		render(
			<QuizConfigForm
				availableTopics={[
					{ id: "topic-a", name: "Tópico A" },
					{ id: "topic-b", name: "Tópico B" },
				]}
				maxQuestions={10}
				defaultValues={defaultConfig}
				isPending={false}
				onSubmit={onSubmit}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /iniciar tentativa/i }));

		expect(onSubmit).toHaveBeenCalledWith({
			order: "original",
			quantity: 10,
			topicFilter: null,
			revealMode: "after",
		});
	});

	it("limits quantity to available count when user enters a higher value", () => {
		const onSubmit = vi.fn();
		render(
			<QuizConfigForm
				availableTopics={[]}
				maxQuestions={5}
				defaultValues={defaultConfig}
				isPending={false}
				onSubmit={onSubmit}
			/>,
		);

		const quantityInput = screen.getByLabelText(/quantidade/i);
		fireEvent.change(quantityInput, { target: { value: "20" } });
		fireEvent.click(screen.getByRole("button", { name: /iniciar tentativa/i }));

		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ quantity: 5 }),
		);
	});

	it("disables start button when no questions are available", () => {
		render(
			<QuizConfigForm
				availableTopics={[]}
				maxQuestions={0}
				defaultValues={defaultConfig}
				isPending={false}
				onSubmit={vi.fn()}
			/>,
		);

		expect(
			screen.getByRole("button", { name: /iniciar tentativa/i }),
		).toBeDisabled();
		expect(screen.getByText(/prova sem questões/i)).toBeInTheDocument();
	});
});
