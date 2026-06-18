import { describe, expect, it } from "vitest";
import { getSessionFromHeaders } from "@/lib/rbac";

describe("require-session", () => {
	it("getSessionFromHeaders returns null without auth headers", async () => {
		await expect(getSessionFromHeaders(new Headers())).resolves.toBeNull();
	});
});
