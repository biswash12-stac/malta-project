import ClientTestimonials from "@/components/layout/ClientTestimonials";
import FeaturedProducts from "@/components/layout/FeaturedProducts";
import HeroSlider from "@/components/layout/HeroSlider";
import ShopByCategory from "@/components/layout/ShopByCategory";


export default function Home() {
  return (
    <main className="w-full bg-white text-black">
    <HeroSlider/>
    <FeaturedProducts/>
    <ShopByCategory/>
    <ClientTestimonials />
    </main>
  );
}
