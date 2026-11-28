
import ClientTestimonials from "@/components/layout/ClientTestimonials";
import FeaturedProducts from "@/components/layout/FeaturedProducts";
import HeroSlider from "@/components/layout/HeroSlider";
import ShopByCategory from "@/components/layout/ShopByCategory";
import CursorGlow from "@/components/ui/CursorGlow";
import BazaarIntro from "@/components/layout/BazaarInto"
import PromoBanners from "@/components/layout/PromoBanners";

export default function Home() {
  return (
    <>
      <BazaarIntro />

      <main className="w-full bg-white text-black">
        <CursorGlow />
        <HeroSlider />
        <FeaturedProducts />
        <PromoBanners/>
        <ShopByCategory />
        <ClientTestimonials />
      </main>
    </>
  );
}
