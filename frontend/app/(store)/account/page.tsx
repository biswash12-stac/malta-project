
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UserRound,
  Mail,
  Phone,
  MapPin,
  Save,
  LogOut,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  ChevronRight,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";

function ProfileForm() {
  const { user, updateProfile, logout } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [address, setAddress] = useState(user?.address ?? "");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success"
  );

  if (!user) return null;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");

    if (!name.trim()) {
      setMessage("Please enter your full name.");
      setMessageType("error");
      return;
    }

    const success = updateProfile({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
    });

    if (success) {
      setMessage("Your profile has been updated successfully!");
      setMessageType("success");
    } else {
      setMessage("Unable to update your profile. Please try again.");
      setMessageType("error");
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
       
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-black"
        >
          <ArrowLeft size={17} />
          Back to Home
        </Link>

        
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-green-700">
            My Account
          </p>

          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            My Profile
          </h1>

          <p className="mt-2 text-gray-500">
            Manage your personal information and account details.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
         
          <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-green-700">
                <UserRound size={42} />
              </div>

              <h2 className="mt-4 text-xl font-bold text-gray-900">
                {user.name}
              </h2>

              <p className="mt-1 break-all text-sm text-gray-500">
                {user.email}
              </p>

              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                <ShieldCheck size={14} />
                {user.role === "admin"
                  ? "Administrator"
                  : "Customer Account"}
              </span>
            </div>

            <div className="my-6 border-t border-gray-100" />

           
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center gap-3">
                <Mail size={17} className="shrink-0 text-gray-400" />
                <span className="break-all">{user.email}</span>
              </div>

              <div className="flex items-center gap-3">
                <Phone size={17} className="shrink-0 text-gray-400" />
                <span>{phone || "No phone added"}</span>
              </div>

              <div className="flex items-center gap-3">
                <MapPin size={17} className="shrink-0 text-gray-400" />
                <span>{address || "No address added"}</span>
              </div>
            </div>

           
            <div className="my-6 border-t border-gray-100" />

            <Link
              href="/orders"
              className="group flex items-center justify-between rounded-xl border border-gray-200 p-4 transition hover:border-green-600 hover:bg-green-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-green-100 text-green-700">
                  <ShoppingBag size={21} />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    My Orders
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Track your purchases
                  </p>
                </div>
              </div>

              <ChevronRight
                size={19}
                className="text-gray-400 transition group-hover:translate-x-1 group-hover:text-green-700"
              />
            </Link>

            
            <button
              onClick={handleLogout}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <LogOut size={17} />
              Logout
            </button>
          </aside>

         
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-7">
              <h2 className="text-xl font-bold text-gray-900">
                Personal Information
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Update your details below to keep your account information
                current.
              </p>
            </div>

         
            {message && (
              <div
                className={`mb-6 flex items-center gap-3 rounded-xl p-4 text-sm ${
                  messageType === "success"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {messageType === "success" ? (
                  <CheckCircle2 size={19} />
                ) : (
                  <AlertCircle size={19} />
                )}

                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
             
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Full Name
                </label>

                <div className="relative">
                  <UserRound
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-11 pr-4 text-sm text-gray-900 outline-none transition focus:border-green-600 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Email Address
                </label>

                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    id="email"
                    type="email"
                    value={user.email}
                    readOnly
                    className="w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-100 py-3.5 pl-11 pr-4 text-sm text-gray-500 outline-none"
                  />
                </div>

                <p className="mt-2 text-xs text-gray-400">
                  Your registered email address cannot be changed here.
                </p>
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Phone Number
                </label>

                <div className="relative">
                  <Phone
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter your phone number"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-11 pr-4 text-sm text-gray-900 outline-none transition focus:border-green-600 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="address"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Delivery Address
                </label>

                <div className="relative">
                  <MapPin
                    size={18}
                    className="absolute left-4 top-4 text-gray-400"
                  />

                  <textarea
                    id="address"
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter your delivery address"
                    className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-11 pr-4 text-sm text-gray-900 outline-none transition focus:border-green-600 focus:bg-white"
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-green-800 sm:w-auto"
                >
                  <Save size={18} />
                  Save Changes
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-green-700" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Login Required
        </h2>

        <p className="mt-2 text-gray-500">
          Please log in to access your profile.
        </p>

        <Link
          href="/login"
          className="mt-5 rounded-xl bg-green-700 px-6 py-3 text-sm font-semibold text-white hover:bg-green-800"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  return <ProfileForm />;
}
