import type { MagicLinkEmailEnv } from "@/env";

export function authLog(message: string, data?: Record<string, unknown>) {
	if (data) {
		console.log(`[auth] ${message}`, data);
		return;
	}
	console.log(`[auth] ${message}`);
}

function redactMagicLinkUrl(url: string): string {
	try {
		const parsed = new URL(url);
		const token = parsed.searchParams.get("token");
		if (token) {
			parsed.searchParams.set("token", `${token.slice(0, 4)}…`);
		}
		return parsed.toString();
	} catch {
		return url.replace(/token=[^&]+/, "token=***");
	}
}

export async function sendMagicLinkEmail(
	env: MagicLinkEmailEnv,
	email: string,
	url: string,
) {
	const fromName = env.EMAIL_FROM_NAME ?? "Study App";
	const fromAddress = env.EMAIL_FROM_ADDRESS ?? "noreply@gugacarbo.space";
	const from = `${fromName} <${fromAddress}>`;

	if (!env.RESEND_API_KEY) {
		authLog("magic link (dev fallback — RESEND_API_KEY not set)", {
			email,
			url,
		});
		return;
	}

	authLog("sending magic link via Resend", {
		email,
		from,
		url: redactMagicLinkUrl(url),
	});

	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from,
			to: [email],
			subject: "Seu link de acesso — Study App",
			text: `Acesse: ${url}`,
			html: `<p>Acesse: <a href="${url}">${url}</a></p>`,
		}),
	});

	const responseText = await response.text();
	let responseBody: unknown = responseText;
	try {
		responseBody = JSON.parse(responseText) as unknown;
	} catch {
		// keep raw text for logging
	}

	if (!response.ok) {
		authLog("Resend request failed", {
			email,
			status: response.status,
			body: responseBody,
		});
		throw new Error(
			`Resend failed: ${response.status} — ${responseText.slice(0, 500)}`,
		);
	}

	const resendId =
		typeof responseBody === "object" &&
		responseBody !== null &&
		"id" in responseBody &&
		typeof responseBody.id === "string"
			? responseBody.id
			: undefined;

	authLog("Resend email accepted", {
		email,
		status: response.status,
		resendId,
	});
}
