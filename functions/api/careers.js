const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
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

function fileExt(name) {
	const parts = String(name || "").toLowerCase().split(".");
	return parts.length > 1 ? parts.pop() : "";
}

function uint8ToBase64(bytes) {
	const chunk = 0x8000;
	let binary = "";
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * @param {FormData} form
 * @param {File | null} file
 */
function buildEmailBodies(form, file) {
	const name = cleanText(form.get("name"), 120);
	const email = cleanText(form.get("email"), 160);
	const phone = cleanText(form.get("phone"), 40);
	const location = cleanText(form.get("location"), 80);
	const position = cleanText(form.get("position"), 80);
	const message = cleanText(form.get("message"), 4000);

	const text = [
		"New career application — Tiong Hock Auto Parts",
		"",
		`Name: ${name}`,
		`Email: ${email}`,
		`Phone: ${phone}`,
		`Preferred location: ${location}`,
		`Position: ${position}`,
		"",
		"About applicant:",
		message,
		"",
		file ? `Attachment: ${file.name} (${file.type || "unknown"}, ${file.size} bytes)` : "Attachment: none",
	].join("\n");

	const html = `
		<h2>New career application</h2>
		<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
			<tr><td><strong>Name</strong></td><td>${escapeHtml(name)}</td></tr>
			<tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>
			<tr><td><strong>Phone</strong></td><td>${escapeHtml(phone)}</td></tr>
			<tr><td><strong>Preferred location</strong></td><td>${escapeHtml(location)}</td></tr>
			<tr><td><strong>Position</strong></td><td>${escapeHtml(position)}</td></tr>
		</table>
		<p style="font-family:sans-serif;font-size:14px;white-space:pre-wrap"><strong>About applicant</strong><br>${escapeHtml(message)}</p>
		<p style="font-family:sans-serif;font-size:13px;color:#64748b">${
			file
				? `Attachment included: ${escapeHtml(file.name)}`
				: "No attachment uploaded."
		}</p>
	`;

	return { text, html, name, email, phone, location, position, message };
}

/**
 * @param {any} env
 * @param {{ text: string, html: string, name: string, email: string }} payload
 * @param {{ filename: string, content: string, contentType: string } | null} attachment
 */
async function sendWithResend(env, payload, attachment) {
	const apiKey = env.RESEND_API_KEY;
	const to = env.CAREERS_TO || "careers@tionghock.com.my";
	const from = env.CAREERS_FROM || "Tiong Hock Careers <onboarding@resend.dev>";

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
		return jsonResponse({ ok: false, error: "Too many applications from this network. Try again later." }, 429, origin);
	}

	let form;
	try {
		form = await context.request.formData();
	} catch {
		return jsonResponse({ ok: false, error: "Invalid form data." }, 400, origin);
	}

	// Honeypot — silently accept bots
	const honey = cleanText(form.get("website") ?? form.get("_honey"), 200);
	if (honey) {
		return jsonResponse({ ok: true }, 200, origin);
	}

	const name = cleanText(form.get("name"), 120);
	const email = cleanText(form.get("email"), 160).toLowerCase();
	const phone = cleanText(form.get("phone"), 40);
	const location = cleanText(form.get("location"), 80);
	const position = cleanText(form.get("position"), 80);
	const message = cleanText(form.get("message"), 4000);

	if (!name || !email || !phone || !location || !position || !message) {
		return jsonResponse({ ok: false, error: "Please complete all required fields." }, 400, origin);
	}
	if (!isEmail(email)) {
		return jsonResponse({ ok: false, error: "Please enter a valid email address." }, 400, origin);
	}

	const rawFile = form.get("attachment");
	/** @type {File | null} */
	let file = null;
	/** @type {{ filename: string, content: string, contentType: string } | null} */
	let attachment = null;

	if (rawFile && typeof rawFile === "object" && "arrayBuffer" in rawFile && rawFile.size > 0) {
		file = /** @type {File} */ (rawFile);
		const ext = fileExt(file.name);
		if (!ALLOWED_EXT.has(ext)) {
			return jsonResponse(
				{ ok: false, error: "Attachment must be PDF, DOC, DOCX, JPG, PNG, or WEBP." },
				400,
				origin,
			);
		}
		if (file.type && !ALLOWED_MIME.has(file.type)) {
			return jsonResponse({ ok: false, error: "Unsupported attachment type." }, 400, origin);
		}
		if (file.size > MAX_FILE_BYTES) {
			return jsonResponse({ ok: false, error: "Attachment must be 5 MB or smaller." }, 400, origin);
		}

		const bytes = new Uint8Array(await file.arrayBuffer());
		attachment = {
			filename: file.name.slice(0, 180) || `resume.${ext}`,
			content: uint8ToBase64(bytes),
			contentType: file.type || "application/octet-stream",
		};
	}

	const bodies = buildEmailBodies(form, file);

	try {
		await sendWithResend(context.env, { ...bodies, position }, attachment);
		return jsonResponse({ ok: true }, 200, origin);
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Send failed";
		const missingKey = /RESEND_API_KEY/i.test(msg);
		return jsonResponse(
			{
				ok: false,
				error: missingKey
					? "Careers email is not configured yet. Please try again later."
					: "Could not send application right now. Please try again later.",
			},
			missingKey ? 503 : 502,
			origin,
		);
	}
}

export async function onRequestGet(context) {
	const origin = context.request.headers.get("Origin") || "";
	return jsonResponse({ ok: false, error: "Use POST" }, 405, origin);
}
