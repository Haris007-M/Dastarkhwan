"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { QRCodeCanvas } from "qrcode.react";
import { LogOut, Trash2, Eye, EyeOff, Download, ExternalLink, Plus } from "lucide-react";
import { supabase } from "@/lib/browser";
import ImagePicker from "@/components/ImagePicker";
import Orders from "@/components/Orders";
import Reports from "@/components/Reports";
import type { Restaurant, Category, Item } from "@/lib/types";

export default function Admin() {
  const router = useRouter();
  const [r, setR] = useState<Restaurant | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [tab, setTab] = useState<"orders" | "items" | "reports" | "settings" | "qr">("orders");
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const qr = useRef<HTMLDivElement>(null);
  const [cat, setCat] = useState(""); const [tableNo, setTableNo] = useState("");
  const [f, setF] = useState({ name: "", price: "", category_id: "", image_url: "", description: "" });
  const [n, setN] = useState({ name: "", slug: "", whatsapp: "" });

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.replace("/admin/login");
    const { data } = await supabase.from("restaurants").select("*").eq("owner_id", session.user.id).maybeSingle();
    setR(data);
    if (data) {
      const [c, i] = await Promise.all([supabase.from("categories").select("id,name,sort").eq("restaurant_id", data.id).order("sort"), supabase.from("items").select("*").eq("restaurant_id", data.id).order("name")]);
      setCats(c.data ?? []); setItems(i.data ?? []);
    }
    setReady(true);
  }, [router]);
  useEffect(() => { load(); }, [load]);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2500); };
  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => { const { error } = await p; say(error ? error.message : ok); if (!error) load(); };

  if (!ready) return <p className="p-8 text-center text-sm">Loading…</p>;
  if (!r) return (
    <main className="mx-auto max-w-sm space-y-3 p-5"><h1 className="text-2xl font-bold">Set up your restaurant</h1>
      <input className="input" placeholder="Restaurant name" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
      <input className="input" placeholder="Menu link name, e.g. zinger-house" value={n.slug} onChange={(e) => setN({ ...n, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
      <input className="input" placeholder="WhatsApp number, e.g. 923001234567" value={n.whatsapp} onChange={(e) => setN({ ...n, whatsapp: e.target.value })} />
      <button className="btn w-full" disabled={!n.name || !n.slug || !n.whatsapp} onClick={() => run(supabase.from("restaurants").insert(n), "Restaurant created")}>Create restaurant</button>
      {toast && <p className="text-sm">{toast}</p>}</main>);

  const url = `${typeof window !== "undefined" ? location.origin : ""}/${r.slug}`;
  const link = tableNo ? `${url}?table=${encodeURIComponent(tableNo)}` : url;
  const download = async () => {
    const c = qr.current?.querySelector("canvas"); if (!c) return;
    const o = document.createElement("canvas"); o.width = 600; o.height = 720;
    const x = o.getContext("2d")!; x.fillStyle = "#fff"; x.fillRect(0, 0, 600, 720); x.drawImage(c, 50, 40, 500, 500);
    x.fillStyle = "#14342b"; x.textAlign = "center"; x.font = "bold 44px sans-serif"; x.fillText(tableNo ? `Table ${tableNo}` : r.name, 300, 610);
    x.font = "28px sans-serif"; x.fillText("Scan to see the menu and order", 300, 660);
    const blob = await new Promise<Blob | null>((ok) => o.toBlob(ok, "image/png")); if (!blob) return;
    const file = new File([blob], `${r.slug}-table-${tableNo || "all"}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); } catch {} return; }
    const l = document.createElement("a"); l.href = URL.createObjectURL(blob); l.download = file.name; l.click();
  };
  const save = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)); run(supabase.from("restaurants").update({ ...d, delivery_fee: Number(d.delivery_fee) || 0 }).eq("id", r.id), "Settings saved"); };

  return (
    <main className="mx-auto max-w-md pb-24">
      <header className="flex items-center justify-between bg-pine p-4 text-white"><div><p className="text-xs text-white/70">Dashboard</p><h1 className="font-bold">{r.name}</h1></div>
        <div className="flex gap-3"><a href={`/${r.slug}`} target="_blank" aria-label="Open menu"><ExternalLink size={20} /></a><button aria-label="Log out" onClick={async () => { await supabase.auth.signOut(); router.replace("/admin/login"); }}><LogOut size={20} /></button></div></header>
      <div className="grid grid-cols-5 gap-1 p-3">{(["orders", "items", "reports", "settings", "qr"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-xl py-2 text-xs font-semibold capitalize ${tab === t ? "bg-pine text-white" : "bg-white"}`}>{t === "qr" ? "QR" : t}</button>)}</div>
      <div className="space-y-4 px-4">
        {tab === "orders" && <Orders rid={r.id} />}
        {tab === "reports" && <Reports rid={r.id} />}
        {tab === "items" && <>
          <div className="flex gap-2"><input className="input" placeholder="New category, e.g. Burgers" value={cat} onChange={(e) => setCat(e.target.value)} /><button className="btn" aria-label="Add category" disabled={!cat} onClick={() => { run(supabase.from("categories").insert({ restaurant_id: r.id, name: cat, sort: cats.length + 1 }), "Category added"); setCat(""); }}><Plus size={18} /></button></div>
          <div className="space-y-2 rounded-2xl bg-white p-3">
            <p className="font-semibold">Add item</p>
            <input className="input" placeholder="Item name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <div className="flex gap-2"><input className="input" inputMode="numeric" placeholder="Price (Rs.)" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
              <select className="input" value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}><option value="">Category</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <ImagePicker value={f.image_url} onChange={(u) => setF({ ...f, image_url: u })} />
            <input className="input" placeholder="Short description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            <button className="btn w-full" disabled={!f.name || !f.price || !f.category_id} onClick={() => { run(supabase.from("items").insert({ restaurant_id: r.id, name: f.name, category_id: f.category_id, price: Number(f.price), image_url: f.image_url || null, description: f.description || null }), "Item added"); setF({ ...f, name: "", price: "", image_url: "", description: "" }); }}>Add item</button>
          </div>
          {items.length === 0 && <p className="text-center text-sm text-pine/60">No items yet. Add a category, then your first item.</p>}
          {items.map((i) => <div key={i.id} className="flex items-center gap-3 rounded-2xl bg-white p-2">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-pine/5">{i.image_url && <Image src={i.image_url} alt="" fill sizes="56px" className="object-cover" />}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{i.name}</p><p className="text-xs text-pine/60">Rs. {i.price} · {cats.find((c) => c.id === i.category_id)?.name}</p></div>
            <button aria-label={i.available ? "Mark sold out" : "Mark available"} onClick={() => run(supabase.from("items").update({ available: !i.available }).eq("id", i.id), i.available ? "Marked sold out" : "Marked available")}>{i.available ? <Eye size={18} /> : <EyeOff size={18} className="opacity-50" />}</button>
            <button aria-label="Delete item" onClick={() => confirm(`Delete ${i.name}?`) && run(supabase.from("items").delete().eq("id", i.id), "Item deleted")}><Trash2 size={18} className="text-red-600" /></button></div>)}
        </>}
        {tab === "settings" && <form onSubmit={save} className="space-y-2 rounded-2xl bg-white p-3">
          {([["name", "Restaurant name"], ["tagline", "Tagline"], ["whatsapp", "WhatsApp number (923001234567)"], ["delivery_fee", "Delivery fee (Rs.)"]] as const).map(([k, p]) => <label key={k} className="block text-xs font-medium">{p}<input name={k} defaultValue={String(r[k] ?? "")} className="input mt-1" /></label>)}
          <label className="block text-xs font-medium">Payment details shown to customers<textarea name="payment_info" defaultValue={r.payment_info ?? ""} rows={3} className="input mt-1" placeholder={"Easypaisa: 0300-1234567 (Ali Raza)\nJazzCash: 0301-7654321"} /></label>
          <div className="text-xs font-medium">Banner image<ImagePicker name="banner_url" value={r.banner_url ?? ""} /></div><label className="block text-xs font-medium">Brand colour<input name="color" type="color" defaultValue={r.color} className="mt-1 h-10 w-full rounded-xl" /></label>
          <button className="btn w-full">Save changes</button></form>}
        {tab === "qr" && <div className="space-y-3 rounded-2xl bg-white p-5 text-center">
          <input className="input" placeholder="Table number, e.g. 5 (empty = general QR)" value={tableNo} onChange={(e) => setTableNo(e.target.value)} />
          <div ref={qr} className="inline-block rounded-xl bg-white p-3"><QRCodeCanvas value={link} size={600} style={{ width: 220, height: 220 }} marginSize={2} /></div>
          <p className="break-all text-sm">{link}</p>
          <button onClick={download} className="btn inline-flex items-center gap-2"><Download size={16} />Save QR image</button><p className="text-xs text-pine/60">On a phone, tap Save, then choose Save Image to put it in Photos.</p></div>}
      </div>
      {toast && <p className="fixed inset-x-4 bottom-5 mx-auto max-w-sm rounded-xl bg-pine p-3 text-center text-sm text-white">{toast}</p>}
    </main>);
}
