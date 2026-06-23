import { ensureDevAdminSession } from "./dev-login-helpers.server";
import { getAuthBindings } from "@/lib/auth";

export async function devLoginAsAdminHandler() {
	const authBindings = await getAuthBindings();
	return ensureDevAdminSession(authBindings);
}
