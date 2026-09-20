const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 20;

/** @type {Map<string, { count: number, reset: number }>} */
const rateMap = new Map();

function corsHeaders(origin) {
	const allowed =
		origin &&
		(/^(https:\/\/(tionghock\.com|www\.tionghock\.com|[\w-]+\.pages\.dev|[\w-]+\.vercel\.app))$/.test(origin) ||
			/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
			/\.ts\.net$/.test(origin));

	return {
		"Access-Control-Allow-Origin": allowed ? origin : "https://tionghock.com",
		"Access-Control-Allow-Methods": "POST, OPTIONS",
		"Access-Control-Allow-Headers": "Accept, Content-Type",
		"Access-Control-Max-Age": "86400",
		"Cache-Control": "private, max-age=0, no-store",
	};
}

function jsonResponse(body, status, origin) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			...corsHeaders(origin),
		},
	});
}

function clientIp(request) {
	return (
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
		"unknown"
	);
}

function checkRateLimit(ip) {
	const now = Date.now();
	const entry = rateMap.get(ip);
	if (!entry || now > entry.reset) {
		rateMap.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
		return true;
	}
	if (entry.count >= RATE_MAX) return false;
	entry.count += 1;
	return true;
}

function cleanText(value, max = 500) {
	return String(value ?? "")
		.replace(/\r\n/g, "\n")
		.trim()
		.slice(0, max);
}

function isEmail(value) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * @param {any} env
 * @param {{ name: string, email: string, subject: string, message: string }} payload
 */
const RESEND_TIMEOUT_MS = 20_000;

class ResendSendError extends Error {
	/** @param {number} statusCode HTTP status to return to the client (never 502). */
	constructor(message, statusCode = 503) {
		super(message);
		this.name = "ResendSendError";
		this.statusCode = statusCode;
	}
}

/**
 * @param {Request} request
 * @returns {Promise<{ fields?: Record<string, unknown>, error?: string }>}
 */
async function parseContactBody(request) {
	const contentType = (request.headers.get("Content-Type") || "").toLowerCase();

	if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
		try {
			const form = await request.formData();
			/** @type {Record<string, unknown>} */
			const fields = {};
			for (const [key, value] of form.entries()) fields[key] = value;
			return { fields };
		} catch {
			return { error: "Invalid form data." };
		}
	}

	let raw = "";
	try {
		raw = await request.text();
	} catch {
		return { error: "Could not read request body." };
	}

	if (!raw.trim()) {
		return { error: "Request body is empty." };
	}

	if (contentType.includes("application/json") || raw.trim().startsWith("{")) {
		try {
			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
				return { error: "Invalid JSON body." };
			}
			return { fields: parsed };
		} catch {
			return { error: "Invalid JSON body." };
		}
	}

	return { error: "Unsupported Content-Type. Send application/json." };
}

/** @param {string} from */
function parseFromAddress(from) {
	const match = String(from).match(/<([^>]+)>/);
	return (match?.[1] ?? String(from)).trim();
}

/** @param {Response} res @param {unknown} data */
function logResendApiFailure(res, data) {
	const record = data && typeof data === "object" ? data : {};
	const nested =
		record.error && typeof record.error === "object" && !Array.isArray(record.error) ? record.error : null;

	console.error(
		"[api/contact] resend api error",
		JSON.stringify({
			httpStatus: res.status,
			name: record.name ?? nested?.name ?? null,
			message:
				record.message ??
				nested?.message ??
				(typeof record.error === "string" ? record.error : null),
			statusCode: record.statusCode ?? nested?.statusCode ?? null,
			body: record,
		}),
	);
}

async function sendWithResend(env, payload) {
	const apiKey = env?.RESEND_API_KEY;
	const to = env?.ENQUIRIES_TO || env?.CONTACT_TO || "enquiries@tionghock.com.my";
	const from =
		env?.ENQUIRIES_FROM || env?.CONTACT_FROM || env?.CAREERS_FROM || "Tiong Hock <onboarding@resend.dev>";

	if (!apiKey) {
		throw new ResendSendError("RESEND_API_KEY is not configured", 503);
	}

	console.error(
		"[api/contact] resend payload (no secrets)",
		JSON.stringify({
			from,
			fromAddress: parseFromAddress(from),
			to: [to],
			reply_to: payload.email,
			subject: `Website enquiry — ${payload.subject}`,
		}),
	);

	const text = [
		"New website enquiry — Tiong Hock Auto Parts",
		"",
		`Name: ${payload.name}`,
		`Email: ${payload.email}`,
		`Subject: ${payload.subject}`,
		"",
		"Message:",
		payload.message,
	].join("\n");

	const html = `
		<h2>New website enquiry</h2>
		<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
			<tr><td><strong>Name</strong></td><td>${escapeHtml(payload.name)}</td></tr>
			<tr><td><strong>Email</strong></td><td>${escapeHtml(payload.email)}</td></tr>
			<tr><td><strong>Subject</strong></td><td>${escapeHtml(payload.subject)}</td></tr>
		</table>
		<p style="font-family:sans-serif;font-size:14px;white-space:pre-wrap"><strong>Message</strong><br>${escapeHtml(payload.message)}</p>
	`;

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);

	let res;
	try {
		res = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from,
				to: [to],
				reply_to: payload.email,
				subject: `Website enquiry — ${payload.subject}`,
				text,
				html,
			}),
			signal: controller.signal,
		});
	} catch (err) {
		const aborted = err instanceof Error && err.name === "AbortError";
		console.error("[api/contact] resend fetch failed", {
			aborted,
			message: err instanceof Error ? err.message : "unknown",
		});
		throw new ResendSendError(aborted ? "Email service timed out." : "Email service unreachable.", 503);
	} finally {
		clearTimeout(timeout);
	}

	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		logResendApiFailure(res, data);
		const nested =
			data?.error && typeof data.error === "object" && !Array.isArray(data.error) ? data.error : null;
		const msg =
			data?.message ??
			nested?.message ??
			(typeof data?.error === "string" ? data.error : null) ??
			`Resend error ${res.status}`;
		throw new ResendSendError(String(msg), 503);
	}
	return data;
}

export async function onRequestOptions(context) {
	return new Response(null, {
		status: 204,
		headers: corsHeaders(context.request.headers.get("Origin") || ""),
	});
}

export async function onRequestPost(context) {
	const origin = context.request.headers.get("Origin") || "";

	try {
		const ip = clientIp(context.request);

		if (!checkRateLimit(ip)) {
			return jsonResponse({ ok: false, error: "Too many messages from this network. Try again later." }, 429, origin);
		}

		const parsed = await parseContactBody(context.request);
		if (parsed.error || !parsed.fields) {
			return jsonResponse({ ok: false, error: parsed.error || "Invalid form data." }, 400, origin);
		}

		const fields = parsed.fields;
		const honey = cleanText(fields.website ?? fields._honey, 200);
		if (honey) {
			return jsonResponse({ ok: true }, 200, origin);
		}

		const name = cleanText(fields.name, 120);
		const email = cleanText(fields.email, 160).toLowerCase();
		const subject = cleanText(fields.subject ?? fields._subject, 200);
		const message = cleanText(fields.message, 4000);

		if (!name || !email || !subject || !message) {
			return jsonResponse({ ok: false, error: "Please complete all required fields." }, 400, origin);
		}
		if (!isEmail(email)) {
			return jsonResponse({ ok: false, error: "Please enter a valid email address." }, 400, origin);
		}

		await sendWithResend(context.env ?? {}, { name, email, subject, message });
		return jsonResponse({ ok: true }, 200, origin);
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Send failed";
		const missingKey = /RESEND_API_KEY/i.test(msg);
		const status =
			err instanceof ResendSendError ? err.statusCode : missingKey ? 503 : 503;

		if (!missingKey) {
			console.error("[api/contact] send failed", { message: msg.slice(0, 200) });
		}

		return jsonResponse(
			{
				ok: false,
				error: missingKey
					? "Contact email is not configured yet. Please try again later."
					: "Could not send right now. Please email enquiries@tionghock.com.my directly.",
			},
			status,
			origin,
		);
	}
}

export async function onRequestGet(context) {
	const origin = context.request.headers.get("Origin") || "";
	const env = context.env ?? {};
	const to = env.ENQUIRIES_TO || env.CONTACT_TO || "enquiries@tionghock.com.my";
	const from =
		env.ENQUIRIES_FROM || env.CONTACT_FROM || env.CAREERS_FROM || "Tiong Hock <onboarding@resend.dev>";

	return jsonResponse(
		{
			ok: true,
			service: "contact",
			resendConfigured: Boolean(env.RESEND_API_KEY),
			envFlags: {
				RESEND_API_KEY: Boolean(env.RESEND_API_KEY),
				ENQUIRIES_FROM: Boolean(env.ENQUIRIES_FROM),
				CONTACT_FROM: Boolean(env.CONTACT_FROM),
				ENQUIRIES_TO: Boolean(env.ENQUIRIES_TO),
				CONTACT_TO: Boolean(env.CONTACT_TO),
				CAREERS_FROM: Boolean(env.CAREERS_FROM),
			},
			effectiveSend: {
				from,
				fromAddress: parseFromAddress(from),
				to: [to],
				replyToField: "reply_to",
				subjectExample: "Website enquiry — {user subject}",
			},
		},
		200,
		origin,
	);
}
