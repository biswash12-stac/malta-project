
"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export default function WebsiteIntro() {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLHeadingElement>(null);
  const lettersRef = useRef<HTMLSpanElement[]>([]);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const container = containerRef.current;
      const logo = logoRef.current;
      const letters = lettersRef.current;
      const tagline = taglineRef.current;
      const line = lineRef.current;

      if (!container || !logo || !tagline || !line) return;

     
      if (sessionStorage.getItem("bazaar-intro-seen")) {
        gsap.set(container, {
          autoAlpha: 0,
          display: "none",
        });
        return;
      }

      const timeline = gsap.timeline({
        defaults: {
          ease: "power3.out",
        },
        onComplete: () => {
          sessionStorage.setItem("bazaar-intro-seen", "true");
        },
      });

      
      gsap.set(letters, {
        y: 80,
        opacity: 0,
        rotateX: -70,
        filter: "blur(10px)",
      });

      gsap.set(tagline, {
        y: 15,
        opacity: 0,
      });

      gsap.set(line, {
        scaleX: 0,
        transformOrigin: "center",
      });

     
      timeline.to(letters, {
        y: 0,
        opacity: 1,
        rotateX: 0,
        filter: "blur(0px)",
        duration: 0.8,
        stagger: 0.08,
      });

      timeline.to(
        line,
        {
          scaleX: 1,
          duration: 0.5,
          ease: "power2.inOut",
        },
        0.45
      );

      timeline.to(
        tagline,
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
        },
        0.65
      );

      
      const changeFont = (
        fontFamily: string,
        position: number
      ) => {
        timeline.to(
          logo,
          {
            opacity: 0.25,
            scale: 0.96,
            duration: 0.12,
            ease: "power1.in",
          },
          position
        );

        timeline.set(
          logo,
          {
            fontFamily,
          },
          position + 0.12
        );

        timeline.to(
          logo,
          {
            opacity: 1,
            scale: 1,
            duration: 0.18,
            ease: "power2.out",
          },
          position + 0.12
        );
      };


      changeFont("Georgia, serif", 1.2);

      changeFont('"Courier New", monospace', 2.2);

      changeFont("Impact, sans-serif", 3.2);

      
      changeFont('"Trebuchet MS", sans-serif', 4.05);

      timeline.to(
        logo,
        {
          scale: 1.12,
          letterSpacing: "0.08em",
          duration: 0.55,
          ease: "power2.inOut",
        },
        4.35
      );

      timeline.to(
        [tagline, line],
        {
          opacity: 0,
          duration: 0.25,
        },
        4.35
      );

      timeline.to(
        container,
        {
          autoAlpha: 0,
          duration: 0.55,
          ease: "power2.inOut",
          onComplete: () => {
            gsap.set(container, { display: "none" });
          },
        },
        4.45
      );

      return () => {
        timeline.kill();
      };
    },
    { scope: containerRef }
  );

  const letters = ["B", "A", "Z", "A", "A", "R"];

  return (
    <div ref={containerRef} className="website-intro">
      <div className="intro-content">
        <div className="intro-overline">
          <span className="intro-dot" />
          WELCOME TO
          <span className="intro-dot" />
        </div>

        <h1 ref={logoRef} className="intro-logo">
          {letters.map((letter, index) => (
            <span
              key={`${letter}-${index}`}
              ref={(element) => {
                if (element) {
                  lettersRef.current[index] = element;
                }
              }}
              className="intro-letter"
            >
              {letter}
            </span>
          ))}
          <span className="intro-period">.</span>
        </h1>

        <div ref={lineRef} className="intro-line" />

        <p ref={taglineRef} className="intro-tagline">
          FRESH. QUALITY. EVERYDAY.
        </p>
      </div>

      <div className="intro-corner intro-corner-left">
        BAZAAR © 2026
      </div>
    </div>
  );
}
