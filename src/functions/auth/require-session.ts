import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { PERM_ADMIN_ACCESS } from "@/db/queries/rbac";
import { getAllowedSignupEmailDomains, isGoogleAuthEnabled } from "@/lib/auth";
import {
	getSessionFromHeaders,
	hasPermission,
	requireAdminSession as requireAdminSessionCore,
	requireSession as requireSessionCore,
} from "@/lib/rbac";

export type AppRouteUser = {
	name: string;
	email: string;
};

export type AppRouteContext = {
	user: AppRouteUser;
	isAdmin: boolean;
};

export type AdminRouteContext = {
	user: AppRouteUser;
};

export const getSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const request = getRequest();
		return getSessionFromHeaders(request.headers);
	},
);

export const requireSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const request = getRequest();
		return requireSessionCore(request.headers);
	},
);

export const requireAdminSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const request = getRequest();
		return requireAdminSessionCore(request.headers);
	},
);

export const getAppRouteContext = createServerFn({ method: "GET" }).handler(
	async (): Promise<AppRouteContext | null> => {
		const request = getRequest();
		try {
			const session = await requireSessionCore(request.headers);
			const isAdmin = await hasPermission(session.user.id, PERM_ADMIN_ACCESS);
			return {
				user: {
					name: session.user.name,
					email: session.user.email,
				},
				isAdmin,
			};
		} catch {
			return null;
		}
	},
);

export const getAllowedSignupEmailDomainsFn = createServerFn({
	method: "GET",
}).handler(async () => getAllowedSignupEmailDomains());

export const getGoogleAuthEnabledFn = createServerFn({ method: "GET" }).handler(
	async () => isGoogleAuthEnabled(),
);
