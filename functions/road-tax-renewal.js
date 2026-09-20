const BODY = "This service is no longer offered by Tiong Hock Auto Parts.";

export function onRequest() {
	return new Response(BODY, {
		status: 410,
		headers: {
			"Content-Type": "text/plain; charset=UTF-8",
			"X-Robots-Tag": "noindex",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
