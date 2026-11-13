
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { gsap } from "gsap";

const slides = [
  {
    id: 1,
    title: "Up to 30% offer",
    subtitle: "Enjoy our big offer",
    buttonText: "Shop Now",
    image: "/images/heroSlider1.png",
    link: "/products",
    background: "bg-[#D8FBD5]",
  },
  {
    id: 2,
    title: "Fresh fruits every day",
    subtitle: "Get fresh fruits at the best prices",
    buttonText: "Explore Now",
    image: "/images/heroSlider2.png",
    link: "/products",
    background: "bg-[#FFF1D6]",
  },
  {
    id: 3,
    title: "Special grocery deals",
    subtitle: "Save more on your daily essentials",
    buttonText: "Buy Now",
    image: "/images/heroSlider3.png",
    link: "/products",
    background: "bg-[#E0F1FF]",
  },
];

export default function HeroSlider() {
  const sliderRef = useRef<HTMLDivElement>(null);

  const titleRefs = useRef<(HTMLHeadingElement | null)[]>([]);
  const subtitleRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const buttonRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const hasEnteredRef = useRef(false);

  const [activeSlide, setActiveSlide] = useState(0);


  const animateSlide = useCallback((index: number) => {
    const title = titleRefs.current[index];
    const subtitle = subtitleRefs.current[index];
    const button = buttonRefs.current[index];
    const image = imageRefs.current[index];

    if (!title || !subtitle || !button || !image) return;

    const elements = [title, subtitle, button, image];

    gsap.killTweensOf(elements);

    const tl = gsap.timeline();

    tl.fromTo(
      title,
      {
        y: 45,
        opacity: 0,
        filter: "blur(10px)",
      },
      {
        y: 0,
        opacity: 1,
        filter: "blur(0px)",
        duration: 0.85,
        ease: "power4.out",
      }
    );

    tl.fromTo(
      subtitle,
      {
        y: 25,
        opacity: 0,
      },
      {
        y: 0,
        opacity: 1,
        duration: 0.65,
        ease: "power3.out",
      },
      "-=0.5"
    );

    tl.fromTo(
      button,
      {
        y: 20,
        opacity: 0,
        scale: 0.9,
      },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.6,
        ease: "back.out(1.7)",
      },
      "-=0.35"
    );

    tl.fromTo(
      image,
      {
        x: 70,
        y: 15,
        opacity: 0,
        scale: 0.75,
        rotation: 8,
        filter: "blur(12px)",
      },
      {
        x: 0,
        y: 0,
        opacity: 1,
        scale: 1,
        rotation: 0,
        filter: "blur(0px)",
        duration: 1.1,
        ease: "power4.out",
      },
      "-=1.1"
    );
  }, []);

 
  useEffect(() => {
    const handleIntroComplete = () => {
      hasEnteredRef.current = true;
      animateSlide(activeSlide);
    };

    window.addEventListener(
      "bazaar:intro-complete",
      handleIntroComplete
    );

   
    if (sessionStorage.getItem("bazaar-intro-played") === "true") {
      requestAnimationFrame(handleIntroComplete);
    }

    return () => {
      window.removeEventListener(
        "bazaar:intro-complete",
        handleIntroComplete
      );
    };
  }, [activeSlide, animateSlide]);

 
  useEffect(() => {
    if (hasEnteredRef.current) {
      animateSlide(activeSlide);
    }
  }, [activeSlide, animateSlide]);

  
  const goToSlide = (index: number) => {
    const container = sliderRef.current;
    const slide = container?.children[index] as HTMLElement | undefined;

    if (!container || !slide) return;

    container.scrollTo({
      left: slide.offsetLeft - container.offsetLeft,
      behavior: "smooth",
    });

    setActiveSlide(index);
  };

  const nextSlide = () => {
    goToSlide((activeSlide + 1) % slides.length);
  };

  const previousSlide = () => {
    goToSlide(
      (activeSlide - 1 + slides.length) % slides.length
    );
  };

 
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((current) => {
        const next = (current + 1) % slides.length;

        const container = sliderRef.current;
        const slide = container?.children[next] as HTMLElement | undefined;

        if (container && slide) {
          container.scrollTo({
            left: slide.offsetLeft - container.offsetLeft,
            behavior: "smooth",
          });
        }

        return next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="w-full overflow-hidden py-4">
      <div className="relative mx-auto w-full">
        <div
          ref={sliderRef}
          className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory px-4 md:px-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className={`relative flex h-[220px] min-w-[88%] snap-start items-center justify-between overflow-hidden rounded-xl px-6 md:h-[300px] md:px-12 lg:min-w-[86%] lg:h-[340px] ${slide.background}`}
            >
             
              <div className="pointer-events-none absolute -right-10 -top-20 h-48 w-48 rounded-full bg-white/20 blur-2xl md:h-72 md:w-72" />

              
              <div className="relative z-10 flex flex-col items-start gap-1 md:gap-2">
                <h2
                  ref={(el) => {
                    titleRefs.current[index] = el;
                  }}
                  className="text-2xl font-bold text-black md:text-4xl lg:text-5xl"
                >
                  {slide.title}
                </h2>

                <p
                  ref={(el) => {
                    subtitleRefs.current[index] = el;
                  }}
                  className="text-sm font-semibold text-green-700 md:text-lg"
                >
                  {slide.subtitle}
                </p>

                <Link
                  ref={(el) => {
                    buttonRefs.current[index] = el;
                  }}
                  href={slide.link}
                  className="mt-1 rounded-sm bg-green-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-700 md:text-sm"
                >
                  {slide.buttonText}
                </Link>
              </div>

              
              <div
                ref={(el) => {
                  imageRefs.current[index] = el;
                }}
                className="relative mr-1 h-[170px] w-[170px] shrink-0 md:mr-8 md:h-[250px] md:w-[250px] lg:h-[290px] lg:w-[290px]"
              >
                <Image
                  src={slide.image}
                  alt={slide.title}
                  fill
                  sizes="(max-width: 768px) 170px, 290px"
                  className="object-contain"
                  priority={slide.id === 1}
                />
              </div>
            </div>
          ))}
        </div>

       
        <button
          onClick={previousSlide}
          aria-label="Previous slide"
          className="absolute left-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md transition hover:bg-gray-100 md:left-3"
        >
          <ChevronLeft size={22} />
        </button>

        
        <button
          onClick={nextSlide}
          aria-label="Next slide"
          className="absolute right-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md transition hover:bg-gray-100 md:right-3"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      
      <div className="mt-4 flex justify-center gap-2">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => goToSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              activeSlide === index
                ? "w-7 bg-green-600"
                : "w-2 bg-gray-300"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
