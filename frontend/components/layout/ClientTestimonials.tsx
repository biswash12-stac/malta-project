
"use client";

import { useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Quote,
  Star,
} from "lucide-react";

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
  const sliderRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollTo = (index: number) => {
    const container = sliderRef.current;
    if (!container) return;

    const card = container.querySelector<HTMLElement>(
      "[data-testimonial-card]"
    );

    if (!card) return;

    const gap = 16;
    const cardWidth = card.offsetWidth + gap;

    container.scrollTo({
      left: index * cardWidth,
      behavior: "smooth",
    });

    setActiveIndex(index);
  };

  const nextSlide = () => {
    scrollTo((activeIndex + 1) % testimonials.length);
  };

  const previousSlide = () => {
    scrollTo(
      (activeIndex - 1 + testimonials.length) %
        testimonials.length
    );
  };

  return (
    <section className="bg-[#F0F6F1] py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">

      
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
              What Our Clients Say
            </h2>

            <div className="mt-3 h-1 w-12 rounded-full bg-green-600" />
          </div>

        
          <div className="flex gap-2">
            <button
              onClick={previousSlide}
              aria-label="Previous testimonial"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm transition hover:bg-green-600 hover:text-white"
            >
              <ChevronLeft size={19} />
            </button>

            <button
              onClick={nextSlide}
              aria-label="Next testimonial"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-white shadow-sm transition hover:bg-green-700"
            >
              <ChevronRight size={19} />
            </button>
          </div>
        </div>

     
        <div
          ref={sliderRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {testimonials.map((item) => (
            <div
              key={item.id}
              data-testimonial-card
              className="w-full min-w-full snap-start rounded-xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md md:min-w-[calc((100%-2rem)/3)] md:w-[calc((100%-2rem)/3)] md:shrink-0"
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
                  {Array.from({ length: item.rating }).map((_, i) => (
                    <Star
                      key={i}
                      size={13}
                      fill="#F59E0B"
                      color="#F59E0B"
                    />
                  ))}
                </div>

              </div>
            </div>
          ))}
        </div>

   
        <div className="mt-5 flex justify-center gap-1.5">
          {testimonials.map((item, index) => (
            <button
              key={item.id}
              onClick={() => scrollTo(index)}
              aria-label={`Show testimonial ${index + 1}`}
              className={`h-2 rounded-full transition-all ${
                activeIndex === index
                  ? "w-6 bg-green-600"
                  : "w-2 bg-green-200"
              }`}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
