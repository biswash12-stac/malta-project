
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Image from "next/image";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Countdown = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

function getCountdown(): Countdown {
  const now = new Date();
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1
  );

  const difference = Math.max(0, end.getTime() - now.getTime());

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (difference / (1000 * 60 * 60)) % 24
  );
  const minutes = Math.floor(
    (difference / (1000 * 60)) % 60
  );
  const seconds = Math.floor((difference / 1000) % 60);

  return {
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

const promotions = [
  {
    id: "meat",
    label: "85% FAT FREE",
    title: "Low-Fat Meat",
    description: "Started at",
    price: "Rs. 799",
    image:
      "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=900&q=85",
    background: "bg-black",
    textColor: "text-white",
    buttonColor: "bg-white text-green-700",
    href: "/products",
  },
  {
    id: "fruit",
    label: "SUMMER SALE",
    title: "100% Fresh Fruit",
    description: "Up to",
    discount: "64% OFF",
    image:
      "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=900&q=85",
    background: "bg-[#FFC900]",
    textColor: "text-[#101A17]",
    buttonColor: "bg-white text-green-700",
    href: "/products",
  },
];

export default function PromoBanners() {
  const containerRef = useRef<HTMLElement>(null);
  const [countdown, setCountdown] = useState<Countdown>(
    getCountdown
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCountdown(getCountdown());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useGSAP(
    () => {
      gsap.from(".promo-card", {
        y: 55,
        opacity: 0,
        duration: 0.9,
        stagger: 0.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 85%",
          once: true,
        },
      });
    },
    { scope: containerRef }
  );

  return (
    <section
      ref={containerRef}
      className="bg-white px-5 py-12 sm:px-8 lg:py-16"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 md:grid-cols-3">
        {/* SALE OF THE MONTH */}
        <Link
          href="/offers"
          className="promo-card group relative flex min-h-[330px] overflow-hidden rounded-xl bg-[#3485C5] text-white"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#3485C5] via-[#3485C5]/90 to-transparent" />

          <div className="relative z-10 flex w-full flex-col items-center px-4 pt-7 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-widest">
              BEST DEALS
            </span>

            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-xl lg:text-2xl">
              Sale of the Month
            </h2>

            <div className="mt-3 flex items-center gap-3 sm:gap-2">
              {[
                { value: countdown.days, label: "DAYS" },
                { value: countdown.hours, label: "HOURS" },
                { value: countdown.minutes, label: "MINS" },
                { value: countdown.seconds, label: "SECS" },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-lg font-medium tabular-nums">
                    {item.value}
                  </p>
                  <p className="text-[8px] tracking-wider text-white/75">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>

            <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-[10px] font-bold text-green-700 transition group-hover:scale-105">
              Shop Now <ArrowRight size={13} />
            </span>
          </div>

          <Image
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            src="https://images.unsplash.com/photo-1540420773420-3366772f4999?w=900&q=85"
            alt="Fresh vegetables and salad ingredients"
            className="absolute inset-x-0 bottom-0 h-[48%] w-full object-cover object-center transition duration-700 group-hover:scale-105"
          />

          <div className="absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-b from-transparent to-black/10" />
        </Link>

        
        {promotions.map((promo) => (
          <Link
            key={promo.id}
            href={promo.href}
            className={`promo-card group relative flex min-h-[330px] overflow-hidden rounded-xl ${promo.background} ${promo.textColor}`}
          >
            <div className="relative z-10 flex w-full flex-col items-center px-4 pt-7 text-center">
              <span className="text-[10px] font-semibold uppercase tracking-widest">
                {promo.label}
              </span>

              <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-xl lg:text-2xl">
                {promo.title}
              </h2>

              <div className="mt-2 flex items-center gap-2 text-xs">
                <span>{promo.description}</span>

                {"price" in promo && (
                  <span className="font-extrabold text-[#FFC900]">
                    {promo.price}
                  </span>
                )}

                {"discount" in promo && (
                  <span className="rounded bg-[#101A17] px-2 py-1 text-[10px] font-bold text-white">
                    {promo.discount}
                  </span>
                )}
              </div>

              <span
                className={`mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 text-[10px] font-bold transition group-hover:scale-105 ${promo.buttonColor}`}
              >
                Shop Now <ArrowRight size={13} />
              </span>
            </div>

            <Image
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              src={promo.image}
              alt={promo.title}
              className="absolute inset-x-0 bottom-0 h-[48%] w-full object-cover object-center transition duration-700 group-hover:scale-105"
            />

            <div className="absolute inset-x-0 bottom-0 h-[35%] bg-gradient-to-t from-black/10 to-transparent" />
          </Link>
        ))}
      </div>
    </section>
  );
}
