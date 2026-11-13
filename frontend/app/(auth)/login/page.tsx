
"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

 
  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/");
      }
    }
  }, [user, isLoading, router]);

  if (isLoading || user) {
    return null;
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    const success = login(email, password);

    if (success) {
      if (email.trim().toLowerCase() === "admin@malta.com") {
        router.replace("/admin");
      } else {
        router.replace("/");
      }
    } else {
      setError("Invalid email or password.");
    }
  };

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-lg">

      
        <Link
          href="/"
          className="text-3xl font-bold tracking-tight text-2xl text-black flex items-center gap-1"
        >
          Malta<span className="text-[#35C477]">.</span>
        </Link>

       
        <div className="mt-12">
          <h1 className="text-4xl font-bold tracking-tight text-black">
            Welcome Back!
          </h1>

          <p className="mt-3 text-gray-500">
            Login to your Malta account and continue shopping.
          </p>
        </div>

       
        <form onSubmit={handleSubmit} className="mt-10 space-y-6">

        
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Email Address
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="malta@gmail.com"
              autoComplete="email"
              className="w-full text-gray-700 rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-[#35C477] focus:ring-2 focus:ring-[#35C477]/20"
            />
          </div>

      
          <div>
            <label className="block text-sm font-medium mb-2 text-2xl text-gray-700">
              Password
            </label>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full text-gray-700 rounded-xl border border-gray-300 px-4 py-3 pr-12 outline-none transition focus:border-[#35C477] focus:ring-2 focus:ring-[#35C477]/20"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
            </div>
          </div>

        
          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}

      
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm text-[#35C477] hover:underline"
            >
              Forgot Password?
            </Link>
          </div>

        
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#35C477] py-3.5 font-semibold text-white transition hover:bg-[#2baa65]"
          >
            Login <ArrowRight size={18} />
          </button>

        </form>

       
        <p className="mt-8 text-center text-sm text-gray-500">
          Dont have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-[#35C477] hover:underline"
          >
            Create Account
          </Link>
        </p>

        
        <div className="mt-8 rounded-xl bg-gray-50 p-4 text-sm">
          <p className="font-semibold text-gray-800">
            Demo Login Credentials
          </p>

          <div className="mt-3 space-y-2">
            <div>
              <p className="font-medium text-gray-700">Customer Account</p>
              <p className="text-gray-600">Email: demo@malta.com</p>
              <p className="text-gray-600">Password: password123</p>
            </div>

            <div>
              <p className="font-medium text-gray-700">Admin Account</p>
              <p className="text-gray-600">Email: admin@malta.com</p>
              <p className="text-gray-600">Password: admin123</p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
