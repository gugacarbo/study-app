import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
	getSessionFromHeaders,
	requireAdminSession as requireAdminSessionCore,
	requireSession as requireSessionCore,
} from "@/lib/rbac";

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
	const request = getRequest();
	return getSessionFromHeaders(request.headers);
});

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
