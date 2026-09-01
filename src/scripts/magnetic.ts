export function initMagnetic() {
	if (!window.matchMedia("(hover: hover) and (min-width: 768px)").matches) return;

	document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((btn) => {
		const strength = 0.35;

		btn.addEventListener("mousemove", (e) => {
			const rect = btn.getBoundingClientRect();
			const x = e.clientX - rect.left - rect.width / 2;
			const y = e.clientY - rect.top - rect.height / 2;
			btn.style.transform = `translate(${x * strength}px, ${y * strength}px) scale(1.04)`;
		});

		btn.addEventListener("mouseleave", () => {
			btn.style.transform = "translate(0px, 0px) scale(1)";
		});
	});
}
