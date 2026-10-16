"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { supabase } from "@/lib/browser";

async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("Could not read this image"))), "image/webp", 0.8));
}

export default function ImagePicker({ value, onChange, name }: { value: string; onChange?: (url: string) => void; name?: string }) {
  const [v, setV] = useState(value); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const cam = useRef<HTMLInputElement>(null); const gal = useRef<HTMLInputElement>(null);
  useEffect(() => setV(value), [value]);
  const pick = async (f?: File) => {
    if (!f) return; setBusy(true); setErr("");
    try {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error("Please log in again");
      const path = `${user.id}/${crypto.randomUUID()}.webp`;
      const { error } = await supabase.storage.from("menu-images").upload(path, await shrink(f), { contentType: "image/webp" });
      if (error) throw error;
      const url = supabase.storage.from("menu-images").getPublicUrl(path).data.publicUrl;
      setV(url); onChange?.(url);
    } catch (e) { setErr(e instanceof Error ? e.message : "Upload failed"); }
    setBusy(false);
  };
  return (
    <div className="mt-1 flex items-center gap-2">
      {name && <input type="hidden" name={name} value={v} />}
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-pine/5">{v && <Image src={v} alt="" fill sizes="56px" className="object-cover" />}</div>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <input ref={gal} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <button type="button" disabled={busy} onClick={() => cam.current?.click()} className="flex items-center gap-1 rounded-xl border border-pine/20 bg-white px-3 py-2 text-sm font-medium">{busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}Camera</button>
      <button type="button" disabled={busy} onClick={() => gal.current?.click()} className="flex items-center gap-1 rounded-xl border border-pine/20 bg-white px-3 py-2 text-sm font-medium"><ImagePlus size={16} />Upload</button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>);
}
