
"use client";

import { AlertTriangle, X } from "lucide-react";

type DeleteCategoryDialogProps = {
  isOpen: boolean;
  categoryName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function DeleteCategoryDialog({
  isOpen,
  categoryName,
  onConfirm,
  onCancel,
}: DeleteCategoryDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle size={24} className="text-red-600" />
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-black"
          >
            <X size={20} />
          </button>
        </div>

        <h2 className="text-xl font-bold text-gray-900">
          Delete Category?
        </h2>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-gray-900">
            {categoryName}
          </span>
          ? This action cannot be undone.
        </p>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Delete Category
          </button>
        </div>
      </div>
    </div>
  );
}
