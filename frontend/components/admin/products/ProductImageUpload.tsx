
"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { X, UploadCloud } from "lucide-react";

type ProductImageUploadProps = {
  value: string;
  onChange: (file: File | null, previewUrl: string) => void;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; 

export default function ProductImageUpload({
  value,
  onChange,
}: ProductImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState("");

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");

    
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Please select a valid PNG, JPG, WEBP or GIF image.");
      event.target.value = "";
      return;
    }

   
    if (file.size > MAX_FILE_SIZE) {
      setError("Image size must be less than 5 MB.");
      event.target.value = "";
      return;
    }

    
    const previewUrl = URL.createObjectURL(file);

    
    onChange(file, previewUrl);
  }

  function handleRemove() {
    setError("");

   
    onChange(null, "");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Product Image *
      </label>

      
      <div
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center transition hover:border-black hover:bg-gray-100"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
          <UploadCloud size={23} className="text-gray-700" />
        </div>

        <p className="text-sm font-semibold text-gray-800">
          Click to upload an image
        </p>

        <p className="mt-1 text-xs text-gray-500">
          PNG, JPG, WEBP or GIF (maximum 5 MB)
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {value && (
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 p-3">
          <img
            src={value}
            alt="Product preview"
            className="h-24 w-24 rounded-lg object-cover"
          />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800">
              Image selected
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Your product image preview.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove selected image"
            className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
          >
            <X size={19} />
          </button>
        </div>
      )}
    </div>
  );
}
