import { describe, expect, it } from "vitest";
import {
	getEmailDomain,
	isAllowedSignupEmail,
} from "@/lib/auth-allowed-email-domain";

describe("auth-allowed-email-domain", () => {
	it("accepts aluno.ifsc.edu.br case-insensitively", () => {
		expect(
			isAllowedSignupEmail("User@aluno.ifsc.edu.br", "aluno.ifsc.edu.br"),
		).toBe(true);
		expect(getEmailDomain("User@aluno.ifsc.edu.br")).toBe("aluno.ifsc.edu.br");
	});

	it("rejects other domains", () => {
		expect(isAllowedSignupEmail("user@gmail.com", "aluno.ifsc.edu.br")).toBe(
			false,
		);
	});

	it("accepts any configured domain in comma-separated list", () => {
		expect(
			isAllowedSignupEmail("user@example.com", "aluno.ifsc.edu.br,example.com"),
		).toBe(true);
	});
});
