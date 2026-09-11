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
async function sendWithResend(env, payload) {
	const apiKey = env.RESEND_API_KEY;
	const to = env.ENQUIRIES_TO || env.CONTACT_TO || "enquiries@tionghock.com.my";
	const from = env.ENQUIRIES_FROM || env.CONTACT_FROM || env.CAREERS_FROM || "Tiong Hock <onboarding@resend.dev>";

	if (!apiKey) {
		throw new Error("RESEND_API_KEY is not configured");
	}

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

	const res = await fetch("https://api.resend.com/emails", {
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
	});

	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		const msg = data?.message || data?.error || `Resend error ${res.status}`;
		throw new Error(String(msg));
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
	const ip = clientIp(context.request);

	if (!checkRateLimit(ip)) {
		return jsonResponse({ ok: false, error: "Too many messages from this network. Try again later." }, 429, origin);
	}

	const contentType = context.request.headers.get("Content-Type") || "";
	/** @type {Record<string, FormDataEntryValue | string>} */
	let fields = {};

	try {
		if (contentType.includes("application/json")) {
			fields = await context.request.json();
		} else {
			const form = await context.request.formData();
			for (const [key, value] of form.entries()) fields[key] = value;
		}
	} catch {
		return jsonResponse({ ok: false, error: "Invalid form data." }, 400, origin);
	}

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

	try {
		await sendWithResend(context.env, { name, email, subject, message });
		return jsonResponse({ ok: true }, 200, origin);
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Send failed";
		const missingKey = /RESEND_API_KEY/i.test(msg);
		return jsonResponse(
			{
				ok: false,
				error: missingKey
					? "Contact email is not configured yet. Please try again later."
					: "Could not send right now. Please email enquiries@tionghock.com.my directly.",
			},
			missingKey ? 503 : 502,
			origin,
		);
	}
}

export async function onRequestGet(context) {
	const origin = context.request.headers.get("Origin") || "";
	return jsonResponse(
		{
			ok: true,
			service: "contact",
			resendConfigured: Boolean(context.env?.RESEND_API_KEY),
		},
		200,
		origin,
	);
}
