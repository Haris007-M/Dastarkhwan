"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/browser";
import { labelRows } from "@/lib/labels";

type O = { id: string; bill_key: string; table_no: string | null; customer_name: string; phone: string | null; code: string | null; order_type: string; address: string | null; items: { name: string; qty: number }[]; total: number; status: string; created_at: string; pay_method: string | null; pay_ref: string | null; pay_requested_at: string | null; pay_batch: string | null; pay_proof: string | null };
const NEXT: Record<string, string> = { new: "preparing", preparing: "ready", ready: "served" };
const LABEL: Record<string, string> = { new: "Start cooking", preparing: "Mark ready", ready: "Mark served" };
const SAY: Record<string, string> = { new: "New", preparing: "Cooking", ready: "Ready", served: "Served" };
const CHIP: Record<string, string> = { new: "bg-red-100 text-red-800", preparing: "bg-amber-100 text-amber-800", ready: "bg-green-100 text-green-800", served: "bg-gray-200 text-gray-700" };
const SIDE: Record<string, string> = { "Dine-in": "border-l-emerald-600", Takeaway: "border-l-amber-500", Delivery: "border-l-sky-600" };

export default function Orders({ rid }: { rid: string }) {
  const [rows, setRows] = useState<O[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({}); const cache = useRef<Record<string, string>>({});
  const paid = async (amt: number, f: (q: any) => any) => { if (!confirm(`Confirm Rs. ${amt} received?`)) return; await f(supabase.from("orders").update({ paid: true, paid_at: new Date().toISOString() }).eq("restaurant_id", rid)); load(); };
  const load = useCallback(async () => {
    const { data } = await supabase.from("orders").select("*").eq("restaurant_id", rid).eq("paid", false).order("created_at");
    const list = (data ?? []) as O[]; setRows(list);
    const todo = Array.from(new Set(list.map((o) => o.pay_proof).filter((x): x is string => !!x && !cache.current[x])));
    if (todo.length) { await Promise.all(todo.map(async (x) => { const { data: u } = await supabase.storage.from("payment-proofs").createSignedUrl(x, 3600); if (u) cache.current[x] = u.signedUrl; })); setUrls({ ...cache.current }); }
  }, [rid]);
  useEffect(() => {
    load();
    const ch = supabase.channel("orders-" + rid).on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${rid}` }, load).subscribe();
    const t = setInterval(load, 20000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [rid, load]);
  const groups = Object.values(rows.reduce<Record<string, O[]>>((a, o) => { (a[o.bill_key] ||= []).push(o); return a; }, {}))
    .sort((a, b) => Number(!!b.find((o) => o.pay_requested_at)) - Number(!!a.find((o) => o.pay_requested_at)) || b[b.length - 1].created_at.localeCompare(a[a.length - 1].created_at));
  if (!groups.length) return <p className="p-6 text-center text-sm text-pine/60">No open orders. New orders appear here instantly.</p>;
  return <div className="space-y-4">{groups.map((g) => {
    const h = g[0], isT = h.bill_key.startsWith("table:"), lab = labelRows(g, (o) => o.order_type);
    const total = g.reduce((s, o) => s + o.total, 0), req = g.find((o) => o.pay_requested_at);
    const bm = g.filter((o) => o.pay_batch).reduce<Record<string, O[]>>((a, o) => { (a[o.pay_batch!] ||= []).push(o); return a; }, {});
    const batches = Object.entries(bm).map(([id, rs]) => ({ id, rs, method: rs[0].pay_method ?? "" }));
    const open = g.filter((o) => !o.pay_batch), openTotal = open.reduce((s, o) => s + o.total, 0);
    const cash = req && (req.pay_method === "Cash" || req.pay_method === "Card");
    return (
      <div key={h.bill_key} className="overflow-hidden rounded-2xl border-2 border-pine/40 bg-white shadow-md">
        <div className="bg-pine px-3 py-2 text-white">
          <p className="font-bold">{isT ? `Table ${h.table_no}` : `${h.order_type} · Code ${h.code}`} · {h.customer_name}</p>
          {!isT && h.phone && <a href={`tel:${h.phone}`} className="text-sm underline">{h.phone}</a>}
          {!isT && h.address && <p className="text-xs text-white/80">{h.address}</p>}
        </div>
        <div className="space-y-2 p-3">
          {g.map((o, k) => (
            <div key={o.id} className={`rounded-xl border border-pine/25 border-l-8 bg-chalk p-2 text-sm ${SIDE[o.order_type]}`}>
              <div className="flex items-center justify-between gap-2"><span className="font-bold">{lab[k]} <span className="rounded bg-pine/10 px-1.5 text-xs">{o.order_type}</span></span><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${CHIP[o.status]}`}>{SAY[o.status]}</span></div>
              {o.order_type !== "Dine-in" && <p className="my-1 rounded bg-amber-100 px-2 py-1 text-xs font-bold">PACK TO GO · {o.customer_name}{o.phone ? ` · ${o.phone}` : ""}{o.address ? ` · ${o.address}` : ""}</p>}
              <ul className="text-xs">{o.items.map((i, n) => <li key={n}>{i.qty} x {i.name}</li>)}</ul>
              <p className="mt-1 text-right text-xs font-semibold">Rs. {o.total}</p>
              {NEXT[o.status] && <button className="btn mt-1 w-full" onClick={async () => { await supabase.from("orders").update({ status: NEXT[o.status] }).eq("id", o.id); load(); }}>{LABEL[o.status]}</button>}
            </div>))}
          {batches.map((b) => { const t = b.rs.reduce((s, o) => s + o.total, 0), x = b.rs[0], cash = b.method === "Cash" || b.method === "Card"; return (
            <div key={b.id} className="space-y-1 rounded-xl border-2 border-amber-500 bg-amber-50 p-2 text-sm">
              <p className="font-bold">{cash ? `Customer wants to pay Rs. ${t} by ${b.method}` : `Customer says Rs. ${t} paid by ${b.method}${x.pay_ref ? ` · Ref ${x.pay_ref}` : ""}`}</p>
              <p className="text-xs">For: {b.rs.map((o) => o.order_type).join(", ")}</p>
              {x.pay_proof && urls[x.pay_proof] && <a href={urls[x.pay_proof]} target="_blank" rel="noreferrer"><img src={urls[x.pay_proof]} alt="Payment screenshot" loading="lazy" className="max-h-40 rounded-lg border" /></a>}
              <button className="btn w-full" onClick={() => paid(t, (q) => q.eq("pay_batch", b.id))}>{cash ? `Cash received: Rs. ${t}` : `Checked, confirm Rs. ${t}`}</button>
            </div>); })}
          {open.length > 0 && <div className="rounded-xl border-2 border-dashed border-pine/40 p-2 text-sm font-semibold">Not paid yet: Rs. {openTotal}. The confirm button appears after the customer sends their payment.</div>}
          <p className="border-t-2 border-pine/20 pt-2 font-bold">Whole bill: Rs. {total}</p>
        </div>
      </div>);
  })}</div>;
}
