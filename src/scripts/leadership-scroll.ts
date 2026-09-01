import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** Extra viewport-heights to hold on the last leader before the next section. */
const LAST_LEADER_HOLD_VH = 2.5;
/** Crossfade length at each leader boundary (in viewport-height units). */
const FADE_VH = 0.28;

function smoothstep(t: number) {
	const clamped = Math.max(0, Math.min(1, t));
	return clamped * clamped * (3 - 2 * clamped);
}

function applyLeaderStates(
	scrollVh: number,
	panels: HTMLElement[],
	photos: HTMLElement[],
) {
	const last = panels.length - 1;

	panels.forEach((panel, i) => {
		const photo = photos[i];
		let alpha = 0;
		let y = 0;
		let scale = 1;

		if (i === last) {
			if (scrollVh < last - FADE_VH) {
				alpha = 0;
				y = 36;
				scale = 1.04;
			} else if (scrollVh < last) {
				const t = smoothstep((scrollVh - (last - FADE_VH)) / FADE_VH);
				alpha = t;
				y = 36 * (1 - t);
				scale = 1.04 - 0.04 * t;
			} else {
				alpha = 1;
				y = 0;
				scale = 1;
			}
		} else {
			const fadeInStart = i - FADE_VH;
			const holdStart = i;
			const holdEnd = i + 1 - FADE_VH;
			const fadeOutEnd = i + 1;

			if (scrollVh < fadeInStart) {
				alpha = 0;
				y = 36;
				scale = 1.04;
			} else if (scrollVh < holdStart && i > 0) {
				const t = smoothstep((scrollVh - fadeInStart) / FADE_VH);
				alpha = t;
				y = 36 * (1 - t);
				scale = 1.04 - 0.04 * t;
			} else if (scrollVh < holdEnd) {
				alpha = 1;
			} else if (scrollVh < fadeOutEnd) {
				const t = smoothstep((scrollVh - holdEnd) / FADE_VH);
				alpha = 1 - t;
				y = -28 * t;
				scale = 1 + 0.03 * t;
			} else {
				alpha = 0;
				y = -28;
				scale = 1.03;
			}
		}

		gsap.set(panel, { autoAlpha: alpha, y });
		if (photo) gsap.set(photo, { autoAlpha: alpha, scale });
	});
}

export function initLeadershipScroll() {
	const track = document.querySelector<HTMLElement>("[data-leadership-scroll]");
	if (!track || window.matchMedia("(max-width: 767px)").matches) return;
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	const pin = track.querySelector<HTMLElement>("[data-leadership-pin]");
	const panels = gsap.utils.toArray<HTMLElement>("[data-leader-panel]");
	const photos = gsap.utils.toArray<HTMLElement>("[data-leader-photo]");
	const dots = gsap.utils.toArray<HTMLElement>("[data-leader-dot]");
	const counter = track.querySelector<HTMLElement>("[data-leader-counter]");

	if (!pin || panels.length === 0) return;

	gsap.registerPlugin(ScrollTrigger);

	const totalVh = panels.length - 1 + LAST_LEADER_HOLD_VH;
	const last = panels.length - 1;

	ScrollTrigger.create({
		trigger: track,
		start: "top top",
		end: () => `+=${window.innerHeight * totalVh}`,
		pin,
		anticipatePin: 1,
		invalidateOnRefresh: true,
		onUpdate: (self) => {
			const scrollVh = self.progress * totalVh;
			applyLeaderStates(scrollVh, panels, photos);

			const index = scrollVh >= last ? last : Math.min(last - 1, Math.max(0, Math.floor(scrollVh)));

			dots.forEach((dot, i) => {
				dot.classList.toggle("active", i === index);
				dot.classList.toggle("w-8", i === index);
				dot.classList.toggle("w-1.5", i !== index);
				dot.classList.toggle("bg-brand-green", i === index);
				dot.classList.toggle("bg-slate-200", i !== index);
			});
			if (counter) counter.textContent = String(index + 1).padStart(2, "0");
		},
	});

	applyLeaderStates(0, panels, photos);
	ScrollTrigger.refresh();
}
