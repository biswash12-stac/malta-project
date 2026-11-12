
"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export default function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const glow = glowRef.current;
    if (!glow) return;

    const moveX = gsap.quickTo(glow, "x", {
      duration: 0.6,
      ease: "power3.out",
    });

    const moveY = gsap.quickTo(glow, "y", {
      duration: 0.6,
      ease: "power3.out",
    });

    const handleMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;

      moveX(event.clientX);
      moveY(event.clientY);

      gsap.to(glow, {
        autoAlpha: 1,
        duration: 0.3,
        overwrite: true,
      });
    };

    const handleLeave = () => {
      gsap.to(glow, {
        autoAlpha: 0,
        duration: 0.3,
      });
    };

    window.addEventListener("pointermove", handleMove);
    document.addEventListener("mouseleave", handleLeave);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
    };
  });

  return <div ref={glowRef} className="cursor-glow" />;
}
