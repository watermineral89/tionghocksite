const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 8;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXT = new Set(["pdf", "doc", "docx", "jpg", "jpeg", "png", "webp"]);
const ALLOWED_MIME = new Set([
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"image/jpeg",
	"image/png",
	"image/webp",
	"application/octet-stream",
]);

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

function fileExt(name) {
	const parts = String(name || "")
		.toLowerCase()
		.split(".");
	return parts.length > 1 ? parts.pop() : "";
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

function buildEmailBodies(fields, fileMeta) {
	const text = [
		"New career application — Tiong Hock Auto Parts",
		"",
		`Name: ${fields.name}`,
		`Email: ${fields.email}`,
		`Phone: ${fields.phone}`,
		`Preferred location: ${fields.location}`,
		`Position: ${fields.position}`,
		"",
		"About applicant:",
		fields.message,
		"",
		fileMeta
			? `Attachment: ${fileMeta.filename} (${fileMeta.contentType || "unknown"})`
			: "Attachment: none",
	].join("\n");

	const html = `
		<h2>New career application</h2>
		<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
			<tr><td><strong>Name</strong></td><td>${escapeHtml(fields.name)}</td></tr>
			<tr><td><strong>Email</strong></td><td>${escapeHtml(fields.email)}</td></tr>
			<tr><td><strong>Phone</strong></td><td>${escapeHtml(fields.phone)}</td></tr>
			<tr><td><strong>Preferred location</strong></td><td>${escapeHtml(fields.location)}</td></tr>
			<tr><td><strong>Position</strong></td><td>${escapeHtml(fields.position)}</td></tr>
		</table>
		<p style="font-family:sans-serif;font-size:14px;white-space:pre-wrap"><strong>About applicant</strong><br>${escapeHtml(fields.message)}</p>
		<p style="font-family:sans-serif;font-size:13px;color:#64748b">${
			fileMeta ? `Attachment included: ${escapeHtml(fileMeta.filename)}` : "No attachment uploaded."
		}</p>
	`;

	return { text, html };
}

async function sendWithResend(payload, attachment) {
	const apiKey = process.env.RESEND_API_KEY;
	const to = process.env.CAREERS_TO || "careers@tionghock.com.my";
	const from = process.env.CAREERS_FROM || "Tiong Hock Careers <onboarding@resend.dev>";

	if (!apiKey) {
		throw new Error("RESEND_API_KEY is not configured");
	}

	/** @type {Record<string, unknown>} */
	const body = {
		from,
		to: [to],
		reply_to: payload.email,
		subject: `Career application — ${payload.name} — ${payload.position || "General"}`,
		text: payload.text,
		html: payload.html,
	};

	if (attachment) {
		body.attachments = [
			{
				filename: attachment.filename,
				content: attachment.content,
				content_type: attachment.contentType,
			},
		];
	}

	const res = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
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
			service: "careers",
			resendConfigured: Boolean(process.env.RESEND_API_KEY),
			careersToConfigured: Boolean(process.env.CAREERS_TO),
			careersFromConfigured: Boolean(process.env.CAREERS_FROM),
		});
	}

	if (req.method !== "POST") {
		return res.status(405).json({ ok: false, error: "Use POST" });
	}

	if (!checkRateLimit(clientIp(req))) {
		return res.status(429).json({ ok: false, error: "Too many applications from this network. Try again later." });
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
	const phone = cleanText(body.phone, 40);
	const location = cleanText(body.location, 80);
	const position = cleanText(body.position, 80);
	const message = cleanText(body.message, 4000);

	if (!name || !email || !phone || !location || !position || !message) {
		return res.status(400).json({ ok: false, error: "Please complete all required fields." });
	}
	if (!isEmail(email)) {
		return res.status(400).json({ ok: false, error: "Please enter a valid email address." });
	}

	/** @type {{ filename: string, content: string, contentType: string } | null} */
	let attachment = null;
	const rawAttachment = body.attachment;

	if (rawAttachment && typeof rawAttachment === "object") {
		const filename = cleanText(rawAttachment.filename || rawAttachment.name, 180);
		const content = String(rawAttachment.content || "");
		const contentType = cleanText(rawAttachment.contentType || rawAttachment.type || "application/octet-stream", 120);
		const ext = fileExt(filename);

		if (!filename || !content) {
			return res.status(400).json({ ok: false, error: "Invalid attachment." });
		}
		if (!ALLOWED_EXT.has(ext)) {
			return res.status(400).json({
				ok: false,
				error: "Attachment must be PDF, DOC, DOCX, JPG, PNG, or WEBP.",
			});
		}
		if (contentType && !ALLOWED_MIME.has(contentType)) {
			return res.status(400).json({ ok: false, error: "Unsupported attachment type." });
		}

		// Rough size check from base64 length
		const approxBytes = Math.floor((content.length * 3) / 4);
		if (approxBytes > MAX_FILE_BYTES) {
			return res.status(400).json({ ok: false, error: "Attachment must be 5 MB or smaller." });
		}

		attachment = {
			filename: filename || `resume.${ext}`,
			content,
			contentType: contentType || "application/octet-stream",
		};
	}

	const fields = { name, email, phone, location, position, message };
	const bodies = buildEmailBodies(fields, attachment);

	try {
		await sendWithResend({ ...bodies, ...fields }, attachment);
		return res.status(200).json({ ok: true });
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Send failed";
		console.error("[api/careers]", msg);
		const missingKey = /RESEND_API_KEY/i.test(msg);
		return res.status(missingKey ? 503 : 502).json({
			ok: false,
			error: missingKey
				? "Careers email is not configured yet. Please try again later."
				: "Could not send application right now. Please try again later.",
		});
	}
}
