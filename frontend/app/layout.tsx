import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { AuthProvider } from "@/context/AuthContext";
import LayoutWrapper from "@/components/layout/LayoutWrapper";
import WebsiteIntro from "@/components/ui/WebsiteIntro";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bazaar - Your Online Store",
  description: "Welcome to Bazaar, your one-stop online store for all your shopping needs. Explore our wide range of products and enjoy a seamless shopping experience.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>
        <AuthProvider>
          <LayoutWrapper>
            {/* <Navbar /> */}
            {/* <WebsiteIntro/> */}
            {children}
            {/* <Footer /> */}
          </LayoutWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
