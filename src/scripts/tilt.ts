export function initTilt() {
	if (!window.matchMedia("(hover: hover) and (min-width: 768px)").matches) return;

	document.querySelectorAll<HTMLElement>("[data-tilt]").forEach((card) => {
		card.addEventListener("mousemove", (e) => {
			const rect = card.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			const rotateX = ((y - rect.height / 2) / rect.height) * -8;
			const rotateY = ((x - rect.width / 2) / rect.width) * 8;
			card.style.setProperty("--mouse-x", `${x}px`);
			card.style.setProperty("--mouse-y", `${y}px`);
			card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
		});

		card.addEventListener("mouseleave", () => {
			card.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
		});
	});
}
