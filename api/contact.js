const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 20;

/** @type {Map<string, { count: number, reset: number }>} */
const rateMap = new Map();

function allowOrigin(origin) {
	if (!origin) return false;
	return (
		/^(https:\/\/(tionghock\.com|www\.tionghock\.com|[\w-]+\.pages\.dev|[\w-]+\.vercel\.app))$/.test(origin) ||
		/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
		/\.ts\.net$/.test(origin)
	);
}

function setCors(res, origin) {
	res.setHeader("Access-Control-Allow-Origin", allowOrigin(origin) ? origin : "https://tionghock.com");
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type");
	res.setHeader("Access-Control-Max-Age", "86400");
	res.setHeader("Cache-Control", "private, max-age=0, no-store");
}

function clientIp(req) {
	const xf = req.headers["x-forwarded-for"];
	if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
	if (Array.isArray(xf) && xf[0]) return String(xf[0]).split(",")[0].trim();
	return req.headers["x-real-ip"] || "unknown";
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

async function readJsonBody(req) {
	if (req.body && typeof req.body === "object") return req.body;
	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	const raw = Buffer.concat(chunks).toString("utf8");
	if (!raw) return {};
	return JSON.parse(raw);
}

async function sendWithResend(payload) {
	const apiKey = process.env.RESEND_API_KEY;
	const to = process.env.ENQUIRIES_TO || process.env.CONTACT_TO || "enquiries@tionghock.com.my";
	const from =
		process.env.ENQUIRIES_FROM ||
		process.env.CONTACT_FROM ||
		process.env.CAREERS_FROM ||
		"Tiong Hock <onboarding@resend.dev>";

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

export default async function handler(req, res) {
	const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
	setCors(res, origin);

	if (req.method === "OPTIONS") {
		return res.status(204).end();
	}

	if (req.method === "GET") {
		return res.status(200).json({
			ok: true,
			service: "contact",
			resendConfigured: Boolean(process.env.RESEND_API_KEY),
			enquiriesToConfigured: Boolean(process.env.ENQUIRIES_TO || process.env.CONTACT_TO),
			enquiriesFromConfigured: Boolean(process.env.ENQUIRIES_FROM || process.env.CONTACT_FROM),
		});
	}

	if (req.method !== "POST") {
		return res.status(405).json({ ok: false, error: "Use POST" });
	}

	if (!checkRateLimit(clientIp(req))) {
		return res.status(429).json({ ok: false, error: "Too many messages from this network. Try again later." });
	}

	let body;
	try {
		body = await readJsonBody(req);
	} catch {
		return res.status(400).json({ ok: false, error: "Invalid JSON body." });
	}

	const honey = cleanText(body.website ?? body._honey, 200);
	if (honey) {
		return res.status(200).json({ ok: true });
	}

	const name = cleanText(body.name, 120);
	const email = cleanText(body.email, 160).toLowerCase();
	const subject = cleanText(body.subject ?? body._subject, 200);
	const message = cleanText(body.message, 4000);

	if (!name || !email || !subject || !message) {
		return res.status(400).json({ ok: false, error: "Please complete all required fields." });
	}
	if (!isEmail(email)) {
		return res.status(400).json({ ok: false, error: "Please enter a valid email address." });
	}

	try {
		await sendWithResend({ name, email, subject, message });
		return res.status(200).json({ ok: true });
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Send failed";
		console.error("[api/contact]", msg);
		const missingKey = /RESEND_API_KEY/i.test(msg);
		return res.status(missingKey ? 503 : 502).json({
			ok: false,
			error: missingKey
				? "Contact email is not configured yet. Please try again later."
				: "Could not send right now. Please email enquiries@tionghock.com.my directly.",
		});
	}
}
