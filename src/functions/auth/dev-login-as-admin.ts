import { createServerFn } from "@tanstack/react-start";

export const devLoginAsAdmin = createServerFn({ method: "POST" }).handler(
	async () => {
		const { devLoginAsAdminHandler } = await import(
			"./dev-login-as-admin.server"
		);
		return devLoginAsAdminHandler();
	},
);
