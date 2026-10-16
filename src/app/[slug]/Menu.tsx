"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import { Plus, Minus, ShoppingBag, X, Send, UtensilsCrossed } from "lucide-react";
import type { Restaurant, Category, Item } from "@/lib/types";

export default function Menu({ r, cats, items }: { r: Restaurant; cats: Category[]; items: Item[] }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("Dine-in");
  const [name, setName] = useState("");
  const [where, setWhere] = useState("");
  const set = (id: string, d: number) => setCart((c) => { const n = Math.max(0, (c[id] ?? 0) + d); const { [id]: _, ...rest } = c; return n ? { ...rest, [id]: n } : rest; });
  const lines = useMemo(() => items.filter((i) => cart[i.id]).map((i) => ({ ...i, qty: cart[i.id] })), [items, cart]);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const sub = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const fee = type === "Delivery" ? r.delivery_fee : 0;
  const send = () => {
    const msg = [`*New order: ${r.name}*`, `Name: ${name}`, `Type: ${type}`, `${type === "Delivery" ? "Address" : type === "Dine-in" ? "Table" : "Note"}: ${where}`, "", ...lines.map((l) => `${l.qty} x ${l.name} = Rs. ${l.qty * l.price}`), "", ...(fee ? [`Delivery: Rs. ${fee}`] : []), `*Total: Rs. ${sub + fee}*`].join("\n");
    window.open(`https://wa.me/${r.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  };
  const ok = name.trim() && (type === "Takeaway" || where.trim());
  return (
    <main className="mx-auto min-h-screen max-w-md pb-28" style={{ "--brand": r.color } as React.CSSProperties}>
      <header className="relative h-52 bg-brand">
        {r.banner_url && <Image src={r.banner_url} alt={r.name} fill priority sizes="448px" className="object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
        <div className="absolute bottom-4 left-5 right-5 text-white"><h1 className="text-2xl font-bold">{r.name}</h1>{r.tagline && <p className="text-sm text-white/85">{r.tagline}</p>}</div>
      </header>
      <nav className="sticky top-0 z-20 flex gap-2 overflow-x-auto bg-chalk/95 px-4 py-3 backdrop-blur [scrollbar-width:none]">
        {cats.map((c) => <a key={c.id} href={`#c-${c.id}`} className="shrink-0 rounded-full border border-pine/15 bg-white px-4 py-1.5 text-sm font-medium active:bg-brand active:text-white">{c.name}</a>)}
      </nav>
      {cats.map((c) => (
        <section key={c.id} id={`c-${c.id}`} className="scroll-mt-14 px-4 pt-3">
          <h2 className="mb-2 text-lg font-bold">{c.name}</h2>
          <div className="space-y-3">
            {items.filter((i) => i.category_id === c.id).map((i) => (
              <article key={i.id} className={`flex gap-3 rounded-2xl bg-white p-3 ${i.available ? "" : "opacity-50"}`}>
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-pine/5">
                  {i.image_url ? <Image src={i.image_url} alt={i.name} fill sizes="96px" loading="lazy" className="object-cover" /> : <UtensilsCrossed className="m-8 opacity-30" />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <h3 className="font-semibold leading-snug">{i.name}</h3>
                  {i.description && <p className="line-clamp-2 text-xs text-pine/60">{i.description}</p>}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="font-bold text-brand">Rs. {i.price}</span>
                    {!i.available ? <span className="text-xs font-medium">Sold out</span> : cart[i.id] ? (
                      <div className="flex items-center gap-3 rounded-full bg-brand px-1 py-1 text-white"><button aria-label="Remove one" onClick={() => set(i.id, -1)} className="p-1"><Minus size={16} /></button><span className="w-4 text-center text-sm font-semibold">{cart[i.id]}</span><button aria-label="Add one" onClick={() => set(i.id, 1)} className="p-1"><Plus size={16} /></button></div>
                    ) : <button onClick={() => set(i.id, 1)} className="flex items-center gap-1 rounded-full border border-brand px-3 py-1 text-sm font-semibold text-brand active:bg-brand active:text-white"><Plus size={14} />Add</button>}
                  </div>
                </div>
              </article>))}
          </div>
        </section>))}
      {cats.length === 0 && <p className="p-8 text-center text-sm text-pine/60">This menu is empty. The owner is still adding items.</p>}
      {count > 0 && !open && (
        <button onClick={() => setOpen(true)} className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md items-center justify-between rounded-2xl bg-brand px-5 py-4 text-white shadow-lg" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
          <span className="flex items-center gap-2 font-semibold"><ShoppingBag size={20} />{count} item{count > 1 ? "s" : ""}</span><span className="font-bold">View cart · Rs. {sub}</span></button>)}
      {open && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/50" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="mx-auto max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-chalk p-5">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Your order</h2><button aria-label="Close cart" onClick={() => setOpen(false)}><X /></button></div>
            {lines.map((l) => <div key={l.id} className="flex items-center justify-between text-sm"><span>{l.qty} x {l.name}</span><span className="flex items-center gap-2 font-semibold">Rs. {l.qty * l.price}<button aria-label="Remove one" onClick={() => set(l.id, -1)}><Minus size={14} /></button></span></div>)}
            <div className="grid grid-cols-3 gap-2">{["Dine-in", "Takeaway", "Delivery"].map((t) => <button key={t} onClick={() => setType(t)} className={`rounded-xl py-2 text-sm font-medium ${type === t ? "bg-brand text-white" : "bg-white"}`}>{t}</button>)}</div>
            <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input" placeholder={type === "Delivery" ? "Full delivery address" : type === "Dine-in" ? "Table number" : "Pickup time or note (optional)"} value={where} onChange={(e) => setWhere(e.target.value)} />
            {fee > 0 && <p className="flex justify-between text-sm"><span>Delivery</span><span>Rs. {fee}</span></p>}
            <button disabled={!ok} onClick={send} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25d366] py-3.5 font-bold text-white disabled:opacity-50"><Send size={18} />Send order on WhatsApp · Rs. {sub + fee}</button>
          </div>
        </div>)}
    </main>);
}
