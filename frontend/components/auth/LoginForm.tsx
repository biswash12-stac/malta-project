
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  ShoppingBag,
} from "lucide-react";

import { loginUser } from "@/services/auth.services";

export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await loginUser({
        email,
        password,
      });

      
      if (result.user.role === "admin") {
        router.replace("/admin");
      } else if (result.user.role === "customer") {
        router.replace("/");
      } else {
        setError("Invalid account role.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">

      
      <Link
        href="/"
        className="mb-8 block text-center text-3xl font-extrabold tracking-tight text-green-700"
      >
        Malta<span className="text-gray-900">.</span>
      </Link>

      
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-green-700">
          <ShoppingBag size={28} />
        </div>

        <h1 className="text-3xl font-bold text-gray-900">
          Welcome Back!
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Login to your Malta account and continue shopping.
        </p>
      </div>

     
      <form onSubmit={handleLogin} className="space-y-5">

        
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Email Address
          </label>

          <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 transition focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-100">
            <Mail size={19} className="text-gray-400" />

            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="h-12 w-full bg-transparent text-sm text-gray-900 outline-none"
            />
          </div>
        </div>

        
        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Password
          </label>

          <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 transition focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-100">
            <Lock size={19} className="text-gray-400" />

            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="h-12 w-full bg-transparent text-sm text-gray-900 outline-none"
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="text-gray-400 hover:text-gray-700"
            >
              {showPassword ? (
                <EyeOff size={19} />
              ) : (
                <Eye size={19} />
              )}
            </button>
          </div>
        </div>

       
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-green-700 hover:text-green-800"
          >
            Forgot Password?
          </Link>
        </div>

        
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-600"
          >
            {error}
          </p>
        )}

        
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-green-700 py-3.5 font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Logging in..." : "Login to Account"}
        </button>

      </form>

     
      <p className="mt-7 text-center text-sm text-gray-500">
        Dont have an account?{" "}
        <Link
          href="/register"
          className="font-bold text-green-700 hover:underline"
        >
          Create Account
        </Link>
      </p>

      <p className="mt-6 text-center text-xs text-gray-400">
        Secure login for Malta customers and administrators.
      </p>

    </div>
  );
}
