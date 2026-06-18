import { describe, expect, it } from "vitest";
import { isAllowedSignupEmail, getEmailDomain } from "@/lib/auth-allowed-email-domain";

describe("auth-allowed-email-domain", () => {
	it("accepts ifsc.edu.br case-insensitively", () => {
		expect(isAllowedSignupEmail("User@ifsc.edu.br", "ifsc.edu.br")).toBe(true);
		expect(getEmailDomain("User@ifsc.edu.br")).toBe("ifsc.edu.br");
	});

	it("rejects other domains", () => {
		expect(isAllowedSignupEmail("user@gmail.com", "ifsc.edu.br")).toBe(false);
	});
});
