import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminUsersPageContent } from "@/features/admin/pages/admin-users-page";

vi.mock("@/features/admin/hooks/use-admin-users", () => ({
	useAdminUsers: () => ({
		data: [
			{
				id: "11111111-1111-4111-8111-111111111111",
				email: "admin@aluno.ifsc.edu.br",
				roles: ["admin", "user"],
			},
			{
				id: "22222222-2222-4222-8222-222222222222",
				email: "aluno@aluno.ifsc.edu.br",
				roles: ["user"],
			},
		],
		setUserRole: { mutateAsync: vi.fn(), isPending: false },
	}),
}));

function renderWithQuery(ui: React.ReactNode) {
	const client = new QueryClient();
	return render(
		<QueryClientProvider client={client}>{ui}</QueryClientProvider>,
	);
}

describe("admin users page", () => {
	afterEach(() => cleanup());

	it("lists users without exposing secrets", () => {
		renderWithQuery(<AdminUsersPageContent />);
		expect(screen.getByText("admin@aluno.ifsc.edu.br")).toBeInTheDocument();
		expect(screen.getByText("aluno@aluno.ifsc.edu.br")).toBeInTheDocument();
		expect(screen.getAllByRole("switch")).toHaveLength(2);
	});
});
