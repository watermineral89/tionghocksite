import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const HOLD_VH = 1;
const LAST_HOLD_VH = 1.5;
const TRANSITION = 0.08;

let galleryScrollTrigger: ScrollTrigger | null = null;

function killGalleryScroll() {
	if (galleryScrollTrigger) {
		galleryScrollTrigger.kill(true);
		galleryScrollTrigger = null;
	}
	ScrollTrigger.getAll().forEach((st) => {
		if (st.vars.trigger instanceof HTMLElement && st.vars.trigger.closest("[data-gallery-scroll-track]")) {
			st.kill(true);
		}
	});
}

export function initGalleryScroll() {
	const track = document.querySelector<HTMLElement>("[data-gallery-scroll-track]");
	if (!track || track.hidden) return;
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	killGalleryScroll();

	const pin = track.querySelector<HTMLElement>("[data-gallery-scroll-pin]");
	const slides = gsap.utils.toArray<HTMLElement>("[data-gallery-slide]");
	const captions = gsap.utils.toArray<HTMLElement>("[data-gallery-caption]");
	const dots = gsap.utils.toArray<HTMLElement>("[data-gallery-dot]");
	const counter = track.querySelector<HTMLElement>("[data-gallery-counter]");

	if (!pin || slides.length === 0) return;

	gsap.registerPlugin(ScrollTrigger);

	const totalVh = slides.length - 1 + LAST_HOLD_VH;

	const tl = gsap.timeline({
		scrollTrigger: {
			trigger: track,
			start: "top top",
			end: () => `+=${window.innerHeight * totalVh}`,
			scrub: 0.5,
			pin,
			anticipatePin: 1,
			invalidateOnRefresh: true,
			onUpdate: (self) => {
				galleryScrollTrigger = self;
				const scrollVh = self.progress * totalVh;
				const index = Math.min(slides.length - 1, Math.floor(scrollVh));
				dots.forEach((dot, i) => {
					dot.classList.toggle("active", i === index);
					dot.classList.toggle("w-8", i === index);
					dot.classList.toggle("w-1.5", i !== index);
					dot.classList.toggle("bg-brand-green", i === index);
					dot.classList.toggle("bg-slate-200", i !== index);
				});
				if (counter) counter.textContent = String(index + 1).padStart(2, "0");
			},
		},
	});

	slides.forEach((slide, index) => {
		const caption = captions[index];
		const startAt = index / totalVh;

		if (index === 0) {
			tl.set(slide, { autoAlpha: 1, scale: 1 }, 0);
			if (caption) tl.set(caption, { autoAlpha: 1, y: 0 }, 0);
			return;
		}

		const prevSlide = slides[index - 1];
		const prevCaption = captions[index - 1];

		tl.to(
			prevSlide,
			{ autoAlpha: 0, scale: 1.03, duration: TRANSITION, ease: "power2.inOut" },
			startAt,
		);

		if (prevCaption) {
			tl.to(prevCaption, { autoAlpha: 0, y: -16, duration: TRANSITION, ease: "power2.inOut" }, startAt);
		}

		tl.fromTo(
			slide,
			{ autoAlpha: 0, scale: 1.04 },
			{ autoAlpha: 1, scale: 1, duration: TRANSITION, ease: "power2.out" },
			startAt + TRANSITION * 0.15,
		);

		if (caption) {
			tl.fromTo(
				caption,
				{ autoAlpha: 0, y: 20 },
				{ autoAlpha: 1, y: 0, duration: TRANSITION, ease: "power2.out" },
				startAt + TRANSITION * 0.15,
			);
		}
	});

	const lastIndex = slides.length - 1;
	const lastStart = lastIndex / totalVh;
	const lastSettled = lastStart + TRANSITION * 1.15;
	const lastSlide = slides[lastIndex];
	const lastCaption = captions[lastIndex];

	tl.set(lastSlide, { autoAlpha: 1, scale: 1 }, lastSettled);
	if (lastCaption) tl.set(lastCaption, { autoAlpha: 1, y: 0 }, lastSettled);
	tl.to({}, { duration: 1 - lastSettled }, lastSettled);

	ScrollTrigger.refresh();
}

export function setGalleryView(view: "scroll" | "grid") {
	const scrollRoot = document.querySelector<HTMLElement>("[data-gallery-scroll-root]");
	const gridRoot = document.querySelector<HTMLElement>("[data-gallery-grid-root]");
	const buttons = document.querySelectorAll<HTMLButtonElement>("[data-gallery-view]");

	if (!scrollRoot || !gridRoot) return;

	const isScroll = view === "scroll";
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	scrollRoot.hidden = !isScroll || reducedMotion;
	gridRoot.hidden = isScroll && !reducedMotion;

	buttons.forEach((btn) => {
		const active = btn.dataset.galleryView === view;
		btn.setAttribute("aria-selected", active ? "true" : "false");
		btn.classList.toggle("bg-brand-green", active);
		btn.classList.toggle("text-white", active);
		btn.classList.toggle("border-brand-green", active);
		btn.classList.toggle("bg-white", !active);
		btn.classList.toggle("text-slate-700", !active);
		btn.classList.toggle("border-slate-200", !active);
	});

	if (isScroll && !reducedMotion) {
		requestAnimationFrame(() => initGalleryScroll());
	} else {
		killGalleryScroll();
	}

	try {
		localStorage.setItem("th-gallery-view", view);
	} catch {
		/* ignore */
	}
}

export function initGalleryPage() {
	const saved = (() => {
		try {
			return localStorage.getItem("th-gallery-view") as "scroll" | "grid" | null;
		} catch {
			return null;
		}
	})();

	const defaultView = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "grid" : saved ?? "scroll";
	setGalleryView(defaultView);

	document.querySelectorAll<HTMLButtonElement>("[data-gallery-view]").forEach((btn) => {
		btn.addEventListener("click", () => {
			const view = btn.dataset.galleryView as "scroll" | "grid";
			if (view) setGalleryView(view);
		});
	});

	window.addEventListener("resize", () => {
		if (!document.querySelector("[data-gallery-scroll-track]")?.hidden) {
			killGalleryScroll();
			initGalleryScroll();
		}
	});
}
