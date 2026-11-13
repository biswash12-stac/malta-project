
"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  UserRound,
  ShieldCheck,
  LockKeyhole,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";

export default function AdminSettingsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">Loading settings...</p>
      </div>
    );
  }

  return <AdminSettingsForm user={user} />;
}

function AdminSettingsForm({
  user,
}: {
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
}) {
  const { updateProfile } = useAuth();

  const [name, setName] = useState(() => user.name || "");
  const [phone, setPhone] = useState(() => user.phone || "");
  const [address, setAddress] = useState(() => user.address || "");

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  const [passwordMessage, setPasswordMessage] = useState("");

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setProfileMessage("");
    setProfileError("");

    if (!name.trim()) {
      setProfileError("Please enter your name.");
      return;
    }

    const success = updateProfile({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
    });

    if (success) {
      setProfileMessage("Profile updated successfully.");
    } else {
      setProfileError("Unable to update your profile.");
    }
  };

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setPasswordMessage("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage("Please complete all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage(
        "New password must contain at least 8 characters.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage(
        "New password and confirmation do not match.",
      );
      return;
    }

    setPasswordMessage(
      "Password changes are not connected yet. Backend integration is required.",
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-7 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Admin Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your administrator profile and security preferences.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-100 p-5">
          <div className="rounded-lg bg-green-50 p-2.5 text-green-700">
            <UserRound size={21} />
          </div>

          <div>
            <h2 className="font-semibold text-gray-900">
              Profile Information
            </h2>
            <p className="text-sm text-gray-500">
              Update your administrator details.
            </p>
          </div>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-5 p-5">
          <div className="flex flex-col items-center gap-3 rounded-xl bg-gray-50 p-5 sm:flex-row">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-700 text-2xl font-bold text-white">
              {name.trim().charAt(0).toUpperCase() || "A"}
            </div>

            <div className="text-center sm:text-left">
              <p className="font-semibold text-gray-900">
                {name || "Administrator"}
              </p>
              <p className="text-sm text-gray-500">{user.email}</p>
              <span className="mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                Administrator
              </span>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Full Name">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
                className="settings-input"
                required
              />
            </FormField>

            <FormField label="Email Address">
              <input
                value={user.email}
                readOnly
                className="settings-input cursor-not-allowed bg-gray-50 text-gray-500"
              />
            </FormField>

            <FormField label="Phone Number">
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Enter phone number"
                className="settings-input"
              />
            </FormField>

            <FormField label="Address">
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Enter your address"
                className="settings-input"
              />
            </FormField>
          </div>

          {profileMessage && (
            <Message type="success" message={profileMessage} />
          )}

          {profileError && (
            <Message type="error" message={profileError} />
          )}

          <div className="flex justify-end border-t border-gray-100 pt-5">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800"
            >
              <Save size={17} />
              Save Profile
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-100 p-5">
          <div className="rounded-lg bg-blue-50 p-2.5 text-blue-700">
            <LockKeyhole size={21} />
          </div>

          <div>
            <h2 className="font-semibold text-gray-900">
              Change Password
            </h2>
            <p className="text-sm text-gray-500">
              Update your administrator password.
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-5 p-5">
          <FormField label="Current Password">
            <PasswordInput
              value={currentPassword}
              onChange={setCurrentPassword}
              visible={showCurrentPassword}
              onToggle={() =>
                setShowCurrentPassword((previous) => !previous)
              }
              placeholder="Enter current password"
            />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="New Password">
              <PasswordInput
                value={newPassword}
                onChange={setNewPassword}
                visible={showNewPassword}
                onToggle={() =>
                  setShowNewPassword((previous) => !previous)
                }
                placeholder="Enter new password"
              />
            </FormField>

            <FormField label="Confirm New Password">
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                placeholder="Confirm new password"
                className="settings-input"
              />
            </FormField>
          </div>

          <p className="text-xs text-gray-500">
            Use at least 8 characters for your new password.
          </p>

          {passwordMessage && (
            <Message type="error" message={passwordMessage} />
          )}

          <div className="flex justify-end border-t border-gray-100 pt-5">
            <button
              type="submit"
              className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Update Password
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-100 p-5">
          <div className="rounded-lg bg-purple-50 p-2.5 text-purple-700">
            <ShieldCheck size={21} />
          </div>

          <div>
            <h2 className="font-semibold text-gray-900">
              Two-Factor Authentication
            </h2>
            <p className="text-sm text-gray-500">
              Additional security for your administrator account.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-medium text-gray-900">
              Enable two-factor authentication
            </p>
            <p className="mt-1 max-w-xl text-sm text-gray-500">
              Add an extra verification step when signing in to your admin
              account.
            </p>

            <p className="mt-3 text-xs text-orange-600">
              Demo toggle only. Real authentication requires backend support.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={twoFactorEnabled}
            onClick={() =>
              setTwoFactorEnabled((previous) => !previous)
            }
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${
              twoFactorEnabled ? "bg-green-700" : "bg-gray-300"
            }`}
            aria-label="Toggle two-factor authentication"
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                twoFactorEnabled ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
          <p className="flex items-center gap-2 text-xs text-gray-500">
            <CheckCircle size={15} className="text-green-600" />
            {twoFactorEnabled
              ? "Demo setting enabled."
              : "Two-factor authentication is currently disabled."}
          </p>
        </div>
      </section>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  visible,
  onToggle,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="settings-input pr-11"
      />

      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

function Message({
  type,
  message,
}: {
  type: "success" | "error";
  message: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
        type === "success"
          ? "bg-green-50 text-green-700"
          : "bg-red-50 text-red-700"
      }`}
    >
      {type === "success" ? (
        <CheckCircle size={17} />
      ) : (
        <AlertCircle size={17} />
      )}
      {message}
    </div>
  );
}
