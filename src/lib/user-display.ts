export function getUserInitials(name: string, email: string): string {
	const trimmedName = name.trim();
	if (trimmedName.length > 0) {
		const parts = trimmedName.split(/\s+/).filter(Boolean);
		if (parts.length >= 2) {
			return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
		}
		return trimmedName.slice(0, 2).toUpperCase();
	}

	return email.slice(0, 2).toUpperCase();
}
