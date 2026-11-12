
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function RegisterPage() {
  const router = useRouter();
  const { register, user, isLoading } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordStrength = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const handleRegister = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const success = register(name, email, password);

    if (!success) {
      setError("An account with this email already exists.");
      setLoading(false);
      return;
    }

    router.push("/login?registered=true");
  };

  if (isLoading) return null;

  if (user) {
    router.replace(
      user.role === "admin" ? "/admin" : "/"
    );
    return null;
  }

  return (
    <main className="min-h-screen bg-white px-5 py-12 text-[#171717] sm:px-8">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xl shadow-black/5 lg:grid-cols-2">

         
          <div className="hidden flex-col justify-between bg-[#101A17] p-12 text-white lg:flex">
            <Link href="/" className="text-3xl font-bold tracking-tight">
              Malta<span className="text-[#35C477]">.</span>
            </Link>

            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-[#35C477]">
                Join the Malta community
              </p>

              <h1 className="max-w-md text-5xl font-bold leading-tight">
                Your next favorite thing is waiting.
              </h1>

              <p className="mt-6 max-w-sm leading-7 text-gray-400">
                Create your account and enjoy a simpler way to discover
                products, explore offers, and shop with Malta.
              </p>
            </div>

            <p className="text-sm text-gray-500">
              © 2026 Malta. All rights reserved.
            </p>
          </div>

         
          <div className="mx-auto w-full max-w-xl px-6 py-10 sm:px-12 lg:py-16">
            <Link
              href="/"
              className="text-2xl font-bold tracking-tight lg:hidden"
            >
              Malta<span className="text-[#35C477]">.</span>
            </Link>

            <div className="mb-8 mt-10 lg:mt-0">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#35C477]">
                Get started
              </p>

              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Create Account
              </h2>

              <p className="mt-3 text-sm leading-6 text-gray-500">
                Create your Malta account and start shopping today.
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-medium">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-sm outline-none transition focus:border-[#35C477] focus:ring-4 focus:ring-[#35C477]/10"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-sm outline-none transition focus:border-[#35C477] focus:ring-4 focus:ring-[#35C477]/10"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium">
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3.5 pr-12 text-sm outline-none transition focus:border-[#35C477] focus:ring-4 focus:ring-[#35C477]/10"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>

                <div className="mt-3">
                  <div className="mb-2 flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full ${
                          passwordStrength >= level
                            ? "bg-[#35C477]"
                            : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    Use 8+ characters, uppercase, numbers, and symbols.
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium">
                  Confirm Password
                </label>

                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3.5 pr-12 text-sm outline-none transition focus:border-[#35C477] focus:ring-4 focus:ring-[#35C477]/10"
                  />

                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    {showConfirm ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#35C477] px-5 py-4 text-sm font-semibold text-white transition hover:bg-[#2eae68] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creating Account..." : "Create Account"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-gray-500">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-[#279d5e] hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
