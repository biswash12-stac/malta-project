
"use client";

import { useState } from "react";
import { Save, X } from "lucide-react";
import type { AdminCategory } from "@/lib/category-storage";

export type CategoryFormValues = {
  name: string;
  nameNp: string;
  isVisible: boolean;
};

type CategoryFormProps = {
  mode: "add" | "edit";
  initialData?: AdminCategory;
  onSubmit: (values: CategoryFormValues) => void;
  onCancel: () => void;
};

export default function CategoryForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
}: CategoryFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [nameNp, setNameNp] = useState(initialData?.nameNp ?? "");
  const [isVisible, setIsVisible] = useState(
    initialData?.isVisible ?? true
  );
  const [error, setError] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const trimmedNameNp = nameNp.trim();

    if (!trimmedName) {
      setError("Please enter the English category name.");
      return;
    }

    if (!trimmedNameNp) {
      setError("Please enter the Nepali category name.");
      return;
    }

    onSubmit({
      name: trimmedName,
      nameNp: trimmedNameNp,
      isVisible,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-gray-200 bg-white p-6"
    >
      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">
          Category Name (English)
        </label>

        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Fruits"
          className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-black"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">
          Category Name (Nepali)
        </label>

        <input
          type="text"
          value={nameNp}
          onChange={(event) => setNameNp(event.target.value)}
          placeholder="जस्तै: फलफूल"
          className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-black"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
        <div>
          <p className="text-sm font-semibold text-gray-800">
            Category Visibility
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Choose whether customers can see this category.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isVisible}
          onClick={() => setIsVisible((previous) => !previous)}
          className={`relative h-6 w-11 rounded-full transition ${
            isVisible ? "bg-green-600" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
              isVisible ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          <X size={17} />
          Cancel
        </button>

        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          <Save size={17} />
          {mode === "add" ? "Create Category" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
