"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/browser";

type O = { id: string; session_id: string; table_no: string | null; customer_name: string; order_type: string; address: string | null; items: { name: string; qty: number }[]; total: number; round: number; status: string; created_at: string };
const NEXT: Record<string, string> = { new: "preparing", preparing: "ready", ready: "served" };
const LABEL: Record<string, string> = { new: "Start cooking", preparing: "Mark ready", ready: "Mark served" };

export default function Orders({ rid }: { rid: string }) {
  const [rows, setRows] = useState<O[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.from("orders").select("*").eq("restaurant_id", rid).eq("paid", false).order("created_at");
    setRows((data ?? []) as O[]);
  }, [rid]);
  useEffect(() => {
    load();
    const ch = supabase.channel("orders-" + rid).on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${rid}` }, load).subscribe();
    const t = setInterval(load, 20000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [rid, load]);
  const groups = Object.values(rows.reduce<Record<string, O[]>>((a, o) => { (a[o.session_id] ||= []).push(o); return a; }, {})).reverse();
  if (!groups.length) return <p className="p-6 text-center text-sm text-pine/60">No open orders. New orders appear here instantly.</p>;
  return <div className="space-y-3">{groups.map((g) => {
    const h = g[0], total = g.reduce((s, o) => s + o.total, 0);
    return (
      <div key={h.session_id} className="space-y-2 rounded-2xl bg-white p-3">
        <p className="font-bold">{h.order_type === "Dine-in" ? `Table ${h.table_no}` : h.order_type} · {h.customer_name}</p>
        {h.address && <p className="text-xs text-pine/60">{h.address}</p>}
        {g.map((o) => (
          <div key={o.id} className="rounded-xl bg-chalk p-2 text-sm">
            <div className="flex items-center justify-between"><span className="font-semibold">{o.round > 1 ? `Add-on #${o.round}` : "Order #1"} · {o.status}</span><span>Rs. {o.total}</span></div>
            <p className="text-xs">{o.items.map((i) => `${i.qty} x ${i.name}`).join(", ")}</p>
            {NEXT[o.status] && <button className="btn mt-2 w-full" onClick={async () => { await supabase.from("orders").update({ status: NEXT[o.status] }).eq("id", o.id); load(); }}>{LABEL[o.status]}</button>}
          </div>))}
        <div className="flex items-center justify-between border-t pt-2"><span className="font-bold">Bill: Rs. {total}</span>
          <button className="btn" onClick={async () => { if (confirm(`Payment of Rs. ${total} received?`)) { await supabase.from("orders").update({ paid: true }).eq("session_id", h.session_id); load(); } }}>Mark paid</button></div>
      </div>);
  })}</div>;
}
