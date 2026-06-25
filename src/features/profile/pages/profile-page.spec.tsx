import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfilePage } from "@/features/profile/pages/profile-page";

const { listAccounts, linkSocial, getGoogleAuthEnabledFn } = vi.hoisted(() => ({
	listAccounts: vi.fn(),
	linkSocial: vi.fn(),
	getGoogleAuthEnabledFn: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		listAccounts,
		linkSocial,
	},
}));

vi.mock("@/functions/auth/require-session", () => ({
	getGoogleAuthEnabledFn,
}));

function renderProfilePage() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});

	return render(
		<QueryClientProvider client={queryClient}>
			<ProfilePage />
		</QueryClientProvider>,
	);
}

describe("ProfilePage", () => {
	afterEach(() => {
		cleanup();
		listAccounts.mockReset();
		linkSocial.mockReset();
		getGoogleAuthEnabledFn.mockReset();
	});

	it("shows Google as unavailable when auth is not configured", async () => {
		getGoogleAuthEnabledFn.mockResolvedValue(false);
		listAccounts.mockResolvedValue({
			data: [],
		});

		renderProfilePage();

		expect(
			await screen.findByText("Login com Google indisponível"),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /vincular conta google/i }),
		).not.toBeInTheDocument();
	});

	it("offers Google linking when auth is enabled and no account is linked", async () => {
		getGoogleAuthEnabledFn.mockResolvedValue(true);
		listAccounts.mockResolvedValue({
			data: [],
		});
		linkSocial.mockResolvedValue({
			data: {
				redirect: true,
				url: "http://localhost:8787/api/auth/sign-in/social",
			},
		});

		renderProfilePage();

		const button = await screen.findByRole("button", {
			name: /vincular conta google/i,
		});

		fireEvent.click(button);

		await waitFor(() => {
			expect(linkSocial).toHaveBeenCalledWith({
				provider: "google",
				callbackURL: "/profile",
			});
		});
	});

	it("shows Google as connected when the account is already linked", async () => {
		getGoogleAuthEnabledFn.mockResolvedValue(true);
		listAccounts.mockResolvedValue({
			data: [
				{
					id: "account-1",
					providerId: "google",
					accountId: "google-user-id",
					userId: "user-1",
					scopes: ["email", "profile"],
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			],
		});

		renderProfilePage();

		expect(await screen.findByText("Conta Google conectada")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /google vinculada/i }),
		).toBeDisabled();
	});
});
