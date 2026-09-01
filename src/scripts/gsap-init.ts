import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initTilt } from "./tilt";
import { initMagnetic } from "./magnetic";

export function initScrollAnimations() {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	gsap.registerPlugin(ScrollTrigger);

	gsap.utils.toArray<HTMLElement>("[data-animate='fade-up']").forEach((el) => {
		gsap.from(el, {
			y: 48,
			opacity: 0,
			duration: 0.9,
			ease: "power3.out",
			immediateRender: false,
			scrollTrigger: {
				trigger: el,
				start: "top 85%",
				toggleActions: "play none none none",
				once: true,
			},
		});
	});

	gsap.utils.toArray<HTMLElement>("[data-animate='stagger-parent']").forEach((parent) => {
		const children = Array.from(parent.children);
		if (children.length === 0) return;

		gsap.from(children, {
			y: 32,
			opacity: 0,
			duration: 0.7,
			stagger: 0.08,
			ease: "power2.out",
			immediateRender: false,
			scrollTrigger: {
				trigger: parent,
				start: "top 80%",
				toggleActions: "play none none none",
				once: true,
			},
		});
	});

	gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
		const trigger = el.parentElement;
		if (!trigger) return;

		gsap.to(el, {
			yPercent: 20,
			ease: "none",
			scrollTrigger: {
				trigger,
				scrub: 1.2,
			},
		});
	});

	initTilt();
	initMagnetic();
}
