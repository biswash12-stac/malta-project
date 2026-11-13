
"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

export default function BazaarIntro() {
    const introRef = useRef<HTMLDivElement>(null);
    const logoRef = useRef<HTMLHeadingElement>(null);
    const taglineRef = useRef<HTMLParagraphElement>(null);
    const lineRef = useRef<HTMLDivElement>(null);
    const labelRef = useRef<HTMLSpanElement>(null);

    useGSAP(
        () => {
            const intro = introRef.current;
            const logo = logoRef.current;
            const tagline = taglineRef.current;
            const line = lineRef.current;
            const label = labelRef.current;

            if (!intro || !logo || !tagline || !line || !label) return;


            if (sessionStorage.getItem("bazaar-intro-played") === "true") {
                gsap.set(intro, { display: "none" });
                return;
            }

            const tl = gsap.timeline({
                defaults: { ease: "power3.out" },
                onComplete: () => {
                    sessionStorage.setItem("bazaar-intro-played", "true");

                    window.dispatchEvent(new Event("bazaar:intro-complete"));

                    gsap.set(intro, { display: "none" });
                },
            });

            gsap.set(logo, {
                opacity: 0,
                y: 35,
                scale: 0.85,
                filter: "blur(15px)",
            });

            gsap.set(tagline, { opacity: 0, y: 15 });
            gsap.set(line, { scaleX: 0, transformOrigin: "left center" });
            gsap.set(label, { opacity: 0 });

            tl.to(logo, {
                opacity: 1,
                y: 0,
                scale: 1,
                filter: "blur(0px)",
                duration: 0.8,
            });


            tl.to(logo, {
                fontFamily: "Georgia, serif",
                duration: 0.12,
            });

            tl.to(logo, {
                fontFamily: "Courier New, monospace",
                duration: 0.12,
            });

            tl.to(logo, {
                fontFamily: "Impact, sans-serif",
                duration: 0.12,
            });

            tl.to(logo, {
                fontFamily: "Arial, sans-serif",
                duration: 0.12,
            });

            tl.to(
                line,
                {
                    scaleX: 1,
                    duration: 1.5,
                    ease: "power2.inOut",
                },
                "-=0.1"
            );

            tl.to(
                tagline,
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.6,
                },
                "-=0.8"
            );

            tl.to(label, { opacity: 1, duration: 0.4 }, "-=0.3");


            tl.to(intro, {
                clipPath: "inset(0% 0% 100% 0%)",
                duration: 0.9,
                ease: "power4.inOut",
            }, "+=0.5");
        },
        { scope: introRef }
    );

    return (
        <div
            ref={introRef}
            className="fixed inset-0 z-[10000] flex h-screen w-full items-center justify-center overflow-hidden bg-[#10110f] text-white"
            style={{ clipPath: "inset(0% 0% 0% 0%)" }}
        >
            <div className="absolute inset-0 opacity-[0.06]">
                <div className="h-full w-full bg-[radial-gradient(circle_at_center,#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
            </div>

            <div className="relative flex w-full max-w-3xl flex-col items-center px-6">
                <span className="mb-7 text-[10px] font-medium uppercase tracking-[0.55em] text-white/40">
                    Welcome to
                </span>

                <h1
                    ref={logoRef}
                    className="text-center text-[clamp(3.8rem,13vw,9rem)] font-black leading-none tracking-[-0.075em]"
                >
                    BAZAAR<span className="text-[#35C477]">.</span>
                </h1>

                <p
                    ref={taglineRef}
                    className="mt-7 text-center text-[10px] font-medium uppercase tracking-[0.32em] text-white/60 sm:text-xs"
                >
                    Your everyday market, reimagined.
                </p>

                <div className="mt-12 h-[2px] w-48 overflow-hidden bg-white/15 sm:w-64">
                    <div
                        ref={lineRef}
                        className="h-full w-full bg-[#35C477]"
                    />
                </div>

                <span
                    ref={labelRef}
                    className="mt-4 text-[9px] uppercase tracking-[0.4em] text-white/35"
                >
                    A better way to shop
                </span>
            </div>

            <div className="absolute bottom-8 left-8 text-[9px] uppercase tracking-[0.3em] text-white/25">
                MALTA.
            </div>

            <div className="absolute bottom-8 right-8 text-[9px] uppercase tracking-[0.3em] text-white/25">
                EST. BAZAAR
            </div>
        </div>
    );
}
