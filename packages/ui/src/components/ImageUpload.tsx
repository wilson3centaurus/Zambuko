"use client";

import { useId, useState } from "react";

type ImageUploadProps = {
  label: string;
  imageUrl?: string | null;
  initials?: string;
  onUpload: (file: File) => Promise<void>;
  shape?: "circle" | "rounded";
};

export function ImageUpload({
  label,
  imageUrl,
  initials = "H",
  onUpload,
  shape = "circle",
}: ImageUploadProps) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const src = preview ?? imageUrl ?? null;

  async function select(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5 MB.");
      return;
    }
    setError("");
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      await onUpload(file);
    } catch (uploadError) {
      setPreview(null);
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className={`grid h-20 w-20 shrink-0 place-items-center overflow-hidden bg-brand-100 text-xl font-black text-brand-800 ${shape === "circle" ? "rounded-full" : "rounded-2xl"}`}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : initials.slice(0, 2).toUpperCase()}
      </div>
      <div>
        <label htmlFor={id} className="inline-flex cursor-pointer items-center rounded-xl bg-brand-700 px-3 py-2 text-sm font-bold text-white hover:bg-brand-800">
          {busy ? "Uploading…" : label}
        </label>
        <input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(event) => select(event.target.files?.[0])}
        />
        <p className="mt-1 text-xs text-slate-500">JPG, PNG or WebP · maximum 5 MB</p>
        {error && <p role="alert" className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
      </div>
    </div>
  );
}
