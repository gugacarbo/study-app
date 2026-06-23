import { getAuthBindings } from "@/lib/auth";
import { ensureDevSessionForEmail } from "./dev-login-helpers.server";

export async function devLoginWithTokenHandler(email: string) {
	const authBindings = await getAuthBindings();
	return ensureDevSessionForEmail(authBindings, email);
}
