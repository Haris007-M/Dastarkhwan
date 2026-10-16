"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/browser";

type O = { id: string; bill_key: string; table_no: string | null; customer_name: string; phone: string | null; code: string | null; order_type: string; address: string | null; items: { name: string; qty: number }[]; total: number; paid: boolean; created_at: string; paid_at: string | null; pay_method: string | null; pay_ref: string | null };
const TYPES = ["Dine-in", "Takeaway", "Delivery"], PAYS = ["Cash", "Easypaisa", "JazzCash", "Bank transfer", "Card"];
const PERIODS: [string, string][] = [["today", "Today"], ["yesterday", "Yesterday"], ["week", "7 days"], ["month", "30 days"], ["date", "Pick date"]];
const rs = (n: number) => `Rs. ${n.toLocaleString()}`;
const sum = (a: O[]) => a.reduce((s, o) => s + o.total, 0);
const fmt = (x: string) => new Date(x).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const who = (o: O) => (o.bill_key.startsWith("table:") ? `Table ${o.table_no}` : `Code ${o.code}`);
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const SIDE: Record<string, string> = { "Dine-in": "border-l-emerald-600", Takeaway: "border-l-amber-500", Delivery: "border-l-sky-600" };

export default function Reports({ rid }: { rid: string }) {
  const [mode, setMode] = useState<"history" | "day">("history");
  const [period, setPeriod] = useState("today"); const [date, setDate] = useState(today());
  const [q, setQ] = useState(""); const [type, setType] = useState(""); const [pay, setPay] = useState(""); const [status, setStatus] = useState("");
  const [rows, setRows] = useState<O[]>([]); const [busy, setBusy] = useState(false); const [note, setNote] = useState("");

  const [from, to] = useMemo(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const add = (n: number) => { const d = new Date(t); d.setDate(d.getDate() + n); return d; };
    if (mode === "day" || period === "date") { const s = new Date(date + "T00:00:00"), e = new Date(s); e.setDate(e.getDate() + 1); return [s, e]; }
    if (period === "today") return [t, add(1)];
    if (period === "yesterday") return [add(-1), t];
    return period === "week" ? [add(-6), add(1)] : [add(-29), add(1)];
  }, [mode, period, date]);

  useEffect(() => {
    let off = false;
    (async () => {
      setBusy(true);
      const s = from.toISOString(), e = to.toISOString();
      const base = supabase.from("orders").select("*").eq("restaurant_id", rid);
      const qy = mode === "day" ? base.or(`and(created_at.gte.${s},created_at.lt.${e}),and(paid_at.gte.${s},paid_at.lt.${e})`) : base.gte("created_at", s).lt("created_at", e);
      const { data } = await qy.order("created_at", { ascending: false }).limit(1000);
      if (!off) { setRows((data ?? []) as O[]); setBusy(false); }
    })();
    return () => { off = true; };
  }, [rid, mode, from, to]);

  const list = useMemo(() => rows.filter((o) => { const t = q.trim().toLowerCase(); return (!type || o.order_type === type) && (!pay || o.pay_method === pay) && (!status || (status === "paid") === o.paid) && (!t || [o.customer_name, o.table_no, o.phone, o.code, o.address].some((v) => v?.toLowerCase().includes(t))); }), [rows, q, type, pay, status]);

  const inDay = (x: string | null) => !!x && new Date(x) >= from && new Date(x) < to;
  const placed = rows.filter((o) => inDay(o.created_at)), collected = rows.filter((o) => o.paid && inDay(o.paid_at)), unpaid = placed.filter((o) => !o.paid);
  const by = (a: O[], k: (o: O) => string) => a.reduce<Record<string, O[]>>((m, o) => { (m[k(o)] ||= []).push(o); return m; }, {});
  const methods = Object.entries(by(collected, (o) => o.pay_method ?? "Not recorded"));
  const types = Object.entries(by(collected, (o) => o.order_type));
  const top = Object.entries(placed.flatMap((o) => o.items).reduce<Record<string, number>>((m, i) => ({ ...m, [i.name]: (m[i.name] ?? 0) + i.qty }), {})).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const text = [`Day report ${date}`, `Orders placed: ${placed.length}`, `Money collected: ${rs(sum(collected))}`, ...methods.map(([m, a]) => `  ${m}: ${rs(sum(a))} (${a.length})`), ...types.map(([m, a]) => `  ${m}: ${rs(sum(a))}`), `Not paid yet: ${rs(sum(unpaid))}`, "Top items:", ...top.map(([n, c]) => `  ${c} x ${n}`)].join("\n");
  const csv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Created", "Table/Code", "Name", "Phone", "Type", "Items", "Total", "Status", "Method", "Reference", "Paid at"];
    const body = (mode === "day" ? placed : list).map((o) => [new Date(o.created_at).toLocaleString(), who(o), o.customer_name, o.phone, o.order_type, o.items.map((i) => `${i.qty} x ${i.name}`).join("; "), o.total, o.paid ? "Paid" : "Unpaid", o.pay_method, o.pay_ref, o.paid_at ? new Date(o.paid_at).toLocaleString() : ""].map(esc).join(","));
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([[head.map(esc).join(","), ...body].join("\n")], { type: "text/csv" })); a.download = `orders-${date}.csv`; a.click();
  };
  const Row = (o: O) => (
    <div key={o.id} className={`rounded-xl border border-pine/25 border-l-8 bg-white p-2 text-sm ${SIDE[o.order_type]}`}>
      <div className="flex justify-between gap-2"><span className="font-bold">{who(o)} · {o.customer_name}</span><span className="font-bold">{rs(o.total)}</span></div>
      <p className="text-xs text-pine/70">{fmt(o.created_at)} · {o.order_type}{o.phone ? ` · ${o.phone}` : ""}</p>
      <p className="text-xs">{o.items.map((i) => `${i.qty} x ${i.name}`).join(", ")}</p>
      <p className={`mt-1 text-xs font-semibold ${o.paid ? "text-green-700" : "text-red-700"}`}>{o.paid ? `Paid via ${o.pay_method ?? "?"}${o.pay_ref ? ` · Ref ${o.pay_ref}` : ""}${o.paid_at ? ` · ${fmt(o.paid_at)}` : ""}` : "Not paid"}</p>
    </div>);
  const Btn = ({ on, f, children }: { on: boolean; f: () => void; children: React.ReactNode }) => <button onClick={f} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${on ? "bg-pine text-white" : "border border-pine/20 bg-white"}`}>{children}</button>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2"><Btn on={mode === "history"} f={() => setMode("history")}>History</Btn><Btn on={mode === "day"} f={() => setMode("day")}>Day report</Btn></div>
      {mode === "history" ? <>
        <div className="flex gap-2 overflow-x-auto">{PERIODS.map(([k, l]) => <Btn key={k} on={period === k} f={() => setPeriod(k)}>{l}</Btn>)}</div>
        {period === "date" && <input type="date" className="input" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />}
        <input className="input" placeholder="Search name, table, phone or code" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="grid grid-cols-3 gap-2">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{TYPES.map((x) => <option key={x}>{x}</option>)}</select>
          <select className="input" value={pay} onChange={(e) => setPay(e.target.value)}><option value="">All payments</option>{PAYS.map((x) => <option key={x}>{x}</option>)}</select>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Paid + unpaid</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option></select></div>
        <p className="text-sm font-semibold">{list.length} orders · {rs(sum(list.filter((o) => o.paid)))} paid · {rs(sum(list.filter((o) => !o.paid)))} unpaid</p>
        {busy ? <p className="text-center text-sm">Loading…</p> : list.length ? <div className="space-y-2">{list.map(Row)}</div> : <p className="p-6 text-center text-sm text-pine/60">No orders match.</p>}
      </> : <>
        <input type="date" className="input" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        {busy ? <p className="text-center text-sm">Loading…</p> : <>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl border-2 border-green-600 bg-white p-3"><p className="text-xs">Money collected</p><p className="text-lg font-bold">{rs(sum(collected))}</p></div>
            <div className="rounded-2xl border-2 border-red-500 bg-white p-3"><p className="text-xs">Not paid yet</p><p className="text-lg font-bold">{rs(sum(unpaid))}</p></div></div>
          <div className="space-y-1 rounded-2xl border-2 border-pine/30 bg-white p-3 text-sm">
            <p className="font-bold">Collected by payment method</p>{methods.length ? methods.map(([m, a]) => <p key={m} className="flex justify-between"><span>{m} ({a.length})</span><span>{rs(sum(a))}</span></p>) : <p className="text-xs">Nothing collected.</p>}
            <p className="pt-2 font-bold">Collected by order type</p>{types.map(([m, a]) => <p key={m} className="flex justify-between"><span>{m}</span><span>{rs(sum(a))}</span></p>)}
            <p className="pt-2 font-bold">Orders placed: {placed.length}</p>
            <p className="pt-1 font-bold">Top items</p>{top.map(([n, c]) => <p key={n} className="flex justify-between"><span>{n}</span><span>{c}</span></p>)}</div>
          <div className="grid grid-cols-2 gap-2"><button className="btn" onClick={async () => { await navigator.clipboard.writeText(text); setNote("Report copied. Paste it in WhatsApp."); setTimeout(() => setNote(""), 3000); }}>Copy report</button><button className="btn" onClick={csv}>Download CSV</button></div>
          {note && <p className="text-center text-xs">{note}</p>}
          <p className="font-bold">Orders placed on this day</p><div className="space-y-2">{placed.map(Row)}</div></>}
      </>}
    </div>);
}
