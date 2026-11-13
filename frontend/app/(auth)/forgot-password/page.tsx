
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password || !confirmPassword) {
      setError("Please complete all fields.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const updated = resetPassword(email, password);

    if (!updated) {
      setError("No customer account was found with this email.");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8faf9] px-5 py-12">
      <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-7 shadow-xl shadow-black/5 sm:p-10">

        <Link
          href="/"
          className="text-2xl font-bold tracking-tight text-[#171717]"
        >
          Malta<span className="text-[#35C477]">.</span>
        </Link>

        {success ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#35C477]/10 text-[#35C477]">
              <CheckCircle2 size={34} />
            </div>

            <h1 className="text-2xl font-bold">
              Password Updated!
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              Your demo account password has been updated successfully.
              You can now sign in using your new password.
            </p>

            <Link
              href="/login"
              className="mt-8 flex w-full items-center justify-center rounded-xl bg-[#35C477] px-5 py-4 text-sm font-semibold text-white transition hover:bg-[#2eae68]"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8 mt-12">
              <Link
                href="/login"
                className="mb-7 inline-flex items-center gap-2 text-sm text-gray-500 transition hover:text-[#35C477]"
              >
                <ArrowLeft size={16} />
                Back to login
              </Link>

              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#35C477]">
                Account recovery
              </p>

              <h1 className="text-3xl font-bold tracking-tight text-2xl text-black">
                Reset Password
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-500">
                Enter your registered email and choose a new password
                for your Malta demo account.
              </p>
            </div>

            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
                  Email Address
                </label>

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="malta@gmail.com"
                  className="w-full rounded-xl text-gray-700 border border-gray-200 px-4 py-3.5 text-sm outline-none transition focus:border-[#35C477] focus:ring-4 focus:ring-[#35C477]/10"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700">
                  New Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full rounded-xl text-gray-700 border border-gray-200 px-4 py-3.5 pr-12 text-sm outline-none transition focus:border-[#35C477] focus:ring-4 focus:ring-[#35C477]/10"
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
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-gray-700">
                  Confirm New Password
                </label>

                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full rounded-xl text-gray-700 border border-gray-200 px-4 py-3.5 pr-12 text-sm outline-none transition focus:border-[#35C477] focus:ring-4 focus:ring-[#35C477]/10"
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
                className="w-full rounded-xl bg-[#35C477] px-5 py-4 text-sm font-semibold text-white transition hover:bg-[#2eae68] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Updating Password..." : "Update Password"}
              </button>
            </form>

            <p className="mt-8 text-center text-xs leading-5 text-gray-400">
              Demo mode: this updates the password stored in this browser.
              It does not send an email.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
