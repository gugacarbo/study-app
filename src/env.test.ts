import { describe, expect, it } from "vitest";
import {
	formatAllowedDomainsHint,
	formatUnauthorizedEmailMessage,
	getAllowedSignupDomains,
	getPlaceholderEmail,
	shouldLogEmailsToConsole,
} from "@/env";

describe("env allowed signup domains", () => {
	it("parses comma-separated domains", () => {
		expect(getAllowedSignupDomains("A.com, b.com")).toEqual(["a.com", "b.com"]);
	});

	it("formats domain hints for UI", () => {
		expect(formatAllowedDomainsHint("ifsc.edu.br,example.com")).toBe(
			"@ifsc.edu.br, @example.com",
		);
	});

	it("builds placeholder from first domain", () => {
		expect(getPlaceholderEmail("ifsc.edu.br,example.com")).toBe(
			"voce@ifsc.edu.br",
		);
	});

	it("builds unauthorized message from configured domains", () => {
		expect(formatUnauthorizedEmailMessage("ifsc.edu.br")).toBe(
			"Este email não está autorizado. Use @ifsc.edu.br.",
		);
	});
});

describe("shouldLogEmailsToConsole", () => {
	it("is true only in development with DEV_LOG_EMAILS enabled", () => {
		expect(shouldLogEmailsToConsole(true, "development")).toBe(true);
		expect(shouldLogEmailsToConsole(true, "production")).toBe(false);
		expect(shouldLogEmailsToConsole(false, "development")).toBe(false);
	});
});
