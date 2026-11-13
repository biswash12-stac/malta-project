
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Quote,
  Star,
} from "lucide-react";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const testimonials = [
  {
    id: 1,
    name: "Biswash Mainali",
    role: "Customer",
    review:
      "The product quality exceeded my expectations. Everything from browsing to checkout was smooth and hassle-free. Definitely shopping here again!",
    initials: "BM",
    color: "bg-orange-200",
    rating: 5,
  },
  {
    id: 2,
    name: "Jay Black",
    role: "Customer",
    review:
      "I'm really impressed with the service. My order arrived quickly, was perfectly packaged, and the product was exactly as shown on the website.",
    initials: "JB",
    color: "bg-purple-200",
    rating: 5,
  },
  {
    id: 3,
    name: "Kiran Timsina",
    role: "Customer",
    review:
      "I'm really impressed with the service. My order arrived quickly, was perfectly packaged, and the product quality was exactly as shown.",
    initials: "KT",
    color: "bg-blue-200",
    rating: 5,
  },
  {
    id: 4,
    name: "Lionel Messi",
    role: "Customer",
    review:
      "Great selection of fresh products and a very easy shopping experience. I will definitely recommend Malta to my friends.",
    initials: "LM",
    color: "bg-green-200",
    rating: 5,
  },
  {
    id: 5,
    name: "Cristiano Ronaldo",
    role: "Customer",
    review:
      "Excellent products, reasonable prices and friendly service. Everything arrived in great condition.",
    initials: "CR",
    color: "bg-pink-200",
    rating: 5,
  },
];

export default function ClientTestimonials() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activeIndexRef = useRef(0);

  const [activeIndex, setActiveIndex] = useState(0);

 
  const updateActiveIndex = useCallback((index: number) => {
    activeIndexRef.current = index;
    setActiveIndex(index);
  }, []);

 
  useGSAP(
    () => {
      const cards = cardRefs.current.filter(
        (card): card is HTMLDivElement => card !== null
      );

      if (!headingRef.current || !cards.length) return;

      const heading = headingRef.current;
      const title = heading.querySelector("h2");
      const underline = heading.querySelector(".testimonial-line");

      const entrance = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          once: true,
        },
      });

      entrance.from(title, {
        y: 35,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
      });

      entrance.from(
        underline,
        {
          scaleX: 0,
          transformOrigin: "left center",
          duration: 0.6,
          ease: "power3.out",
        },
        "-=0.35"
      );

      entrance.from(
        cards,
        {
          y: 65,
          opacity: 0,
          scale: 0.96,
          duration: 0.8,
          stagger: 0.16,
          ease: "power3.out",
          clearProps: "all",
        },
        "-=0.25"
      );

      
      cards.forEach((card) => {
        const handleEnter = () => {
          gsap.to(card, {
            y: -8,
            scale: 1.015,
            duration: 0.35,
            ease: "power2.out",
            boxShadow: "0 18px 35px rgba(0,0,0,0.08)",
          });
        };

        const handleLeave = () => {
          gsap.to(card, {
            y: 0,
            scale: 1,
            duration: 0.4,
            ease: "power2.out",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          });
        };

        card.addEventListener("mouseenter", handleEnter);
        card.addEventListener("mouseleave", handleLeave);

       
        gsap.context(() => {
          return () => {
            card.removeEventListener("mouseenter", handleEnter);
            card.removeEventListener("mouseleave", handleLeave);
          };
        });
      });
    },
    { scope: sectionRef }
  );


  useEffect(() => {
    const container = sliderRef.current;
    if (!container) return;

    const handleScroll = () => {
      const cards = Array.from(
        container.querySelectorAll<HTMLElement>(
          "[data-testimonial-card]"
        )
      );

      if (!cards.length) return;

      let nearestIndex = 0;
      let smallestDistance = Infinity;

      cards.forEach((card, index) => {
        const distance = Math.abs(
          card.offsetLeft - container.scrollLeft
        );

        if (distance < smallestDistance) {
          smallestDistance = distance;
          nearestIndex = index;
        }
      });

      updateActiveIndex(nearestIndex);
    };

    container.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [updateActiveIndex]);

 
  const scrollTo = (index: number) => {
    const container = sliderRef.current;
    if (!container) return;

    const cards = Array.from(
      container.querySelectorAll<HTMLElement>(
        "[data-testimonial-card]"
      )
    );

    const targetCard = cards[index];
    if (!targetCard) return;

    const targetPosition = targetCard.offsetLeft;

    gsap.to(container, {
      scrollLeft: targetPosition,
      duration: 0.8,
      ease: "power3.inOut",
      overwrite: true,
      onUpdate: () => {
        const currentCards = Array.from(
          container.querySelectorAll<HTMLElement>(
            "[data-testimonial-card]"
          )
        );

        let nearestIndex = 0;
        let smallestDistance = Infinity;

        currentCards.forEach((card, cardIndex) => {
          const distance = Math.abs(
            card.offsetLeft - container.scrollLeft
          );

          if (distance < smallestDistance) {
            smallestDistance = distance;
            nearestIndex = cardIndex;
          }
        });

        updateActiveIndex(nearestIndex);
      },
    });
  };

  const nextSlide = () => {
    const nextIndex =
      (activeIndexRef.current + 1) % testimonials.length;

    scrollTo(nextIndex);
  };

  const previousSlide = () => {
    const previousIndex =
      (activeIndexRef.current - 1 + testimonials.length) %
      testimonials.length;

    scrollTo(previousIndex);
  };

  return (
    <section
      ref={sectionRef}
      className="bg-[#F0F6F1] py-14 md:py-20"
    >
      <div className="mx-auto max-w-7xl px-5 md:px-8">

        
        <div
          ref={headingRef}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
              What Our Clients Say
            </h2>

            <div className="testimonial-line mt-3 h-1 w-12 rounded-full bg-green-600" />
          </div>

         
          <div className="flex gap-2">
            <button
              type="button"
              onClick={previousSlide}
              aria-label="Previous testimonial"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm transition-colors hover:bg-green-600 hover:text-white"
            >
              <ChevronLeft size={19} />
            </button>

            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next testimonial"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-white shadow-sm transition-colors hover:bg-green-700"
            >
              <ChevronRight size={19} />
            </button>
          </div>
        </div>

       
        <div
          ref={sliderRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {testimonials.map((item, index) => (
            <div
              key={item.id}
              ref={(element) => {
                cardRefs.current[index] = element;
              }}
              data-testimonial-card
              className="w-full min-w-full shrink-0 snap-start rounded-xl bg-white p-5 shadow-sm md:w-[calc((100%-2rem)/3)] md:min-w-[calc((100%-2rem)/3)]"
            >
              <Quote
                size={25}
                className="mb-3 fill-green-100 text-green-600"
              />

              <p className="min-h-[85px] text-sm leading-6 text-gray-600">
                {item.review}
              </p>

              <div className="mt-5 flex items-center justify-between gap-2">

               
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-gray-700 ${item.color}`}
                  >
                    {item.initials}
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      {item.name}
                    </h3>

                    <p className="text-xs text-gray-400">
                      {item.role}
                    </p>
                  </div>
                </div>

             
                <div className="flex shrink-0 items-center gap-0.5">
                  {Array.from({ length: item.rating }).map(
                    (_, i) => (
                      <Star
                        key={i}
                        size={13}
                        fill="#F59E0B"
                        color="#F59E0B"
                      />
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

      
        <div className="mt-5 flex justify-center gap-1.5">
          {testimonials.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollTo(index)}
              aria-label={`Show testimonial ${index + 1}`}
              aria-current={
                activeIndex === index ? "true" : undefined
              }
              className={`h-2 rounded-full transition-all duration-300 ${
                activeIndex === index
                  ? "w-6 bg-green-600"
                  : "w-2 bg-green-200 hover:bg-green-400"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
