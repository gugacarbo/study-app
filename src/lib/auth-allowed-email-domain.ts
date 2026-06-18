import { getAllowedSignupDomains } from "@/env";

export function getEmailDomain(email: string): string | null {
	const at = email.lastIndexOf("@");
	if (at <= 0 || at === email.length - 1) return null;
	return email.slice(at + 1).trim().toLowerCase();
}

export function isAllowedSignupEmail(
	email: string,
	allowedDomainsRaw: string,
): boolean {
	const domain = getEmailDomain(email);
	if (!domain) return false;
	const allowed = getAllowedSignupDomains(allowedDomainsRaw);
	return allowed.includes(domain);
}
