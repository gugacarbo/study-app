import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const devLoginSchema = z.object({
	token: z.string().trim().min(1),
});

export const devLoginWithToken = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => devLoginSchema.parse(data))
	.handler(async ({ data }) => {
		const { devLoginWithTokenHandler } = await import(
			"./dev-login-with-token.server"
		);
		return devLoginWithTokenHandler(data.token);
	});
