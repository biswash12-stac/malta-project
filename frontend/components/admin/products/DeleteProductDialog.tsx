
"use client";

import { AlertTriangle, Trash2, X } from "lucide-react";

type DeleteProductDialogProps = {
  isOpen: boolean;
  productName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function DeleteProductDialog({
  isOpen,
  productName,
  onConfirm,
  onCancel,
}: DeleteProductDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
       
        <div className="flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="text-red-600" size={24} />
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        
        <div className="mt-5">
          <h2 className="text-xl font-bold text-gray-900">
            Delete Product?
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-gray-900">
              {productName}
            </span>
            ? This action cannot be undone.
          </p>
        </div>

       
        <div className="mt-7 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-red-700"
          >
            <Trash2 size={16} />
            Delete Product
          </button>
        </div>
      </div>
    </div>
  );
}
