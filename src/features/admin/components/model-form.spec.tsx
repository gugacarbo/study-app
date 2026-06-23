import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModelForm } from "@/features/admin/components/model-form";

describe("ModelForm", () => {
	it("passes a configurable timeout to the test callback", () => {
		const onTest = vi.fn();

		render(
			<ModelForm
				submitLabel="Salvar"
				defaultValues={{ modelId: "gpt-5", displayName: "GPT-5", enabled: true }}
				onSubmit={() => {}}
				onTest={onTest}
			/>,
		);

		fireEvent.change(screen.getByLabelText("Timeout do teste (s)"), {
			target: { value: "45" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Testar" }));

		expect(onTest).toHaveBeenCalledWith({
			modelId: "gpt-5",
			timeoutMs: 45_000,
		});
	});
});
