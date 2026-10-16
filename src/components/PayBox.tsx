"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
const METHODS = ["Cash", "Easypaisa", "JazzCash", "Bank transfer", "Card"];
type P = { slug: string; table: string; session: string; code: string | null; total: number; info: string | null; requested: string | null; onDone: () => void };
export default function PayBox({ slug, table, session, code, total, info, requested, onDone }: P) {
  const [open, setOpen] = useState(false); const [m, setM] = useState("Cash"); const [ref, setRef] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  if (requested) return <p className="rounded-xl bg-amber-100 p-2 text-sm font-semibold">Payment by {requested} sent. Waiting for the restaurant to confirm.</p>;
  if (!open) return <button onClick={() => setOpen(true)} className="btn w-full">Pay Rs. {total}</button>;
  const digital = m !== "Cash" && m !== "Card";
  const send = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("request_payment", { p_slug: slug, p_table: table, p_session: session, p_code: code ?? "", p_method: m, p_ref: ref });
    setBusy(false); if (error) setErr(error.message); else onDone();
  };
  return (
    <div className="space-y-2 rounded-xl border border-pine/20 p-2">
      <div className="grid grid-cols-3 gap-1">{METHODS.map((x) => <button key={x} onClick={() => setM(x)} className={`rounded-lg py-1.5 text-xs font-semibold ${m === x ? "bg-pine text-white" : "bg-chalk"}`}>{x}</button>)}</div>
      {digital ? <>
        {info && <p className="whitespace-pre-line rounded-lg bg-chalk p-2 text-xs">{info}</p>}
        <p className="text-xs">Send Rs. {total}, then enter the transaction ID from your receipt.</p>
        <input className="input" placeholder="Transaction ID" value={ref} onChange={(e) => setRef(e.target.value)} /></>
        : <p className="text-xs">Staff will come to take Rs. {total} ({m.toLowerCase()}).</p>}
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button disabled={busy || (digital && ref.trim().length < 4)} onClick={send} className="btn w-full">{digital ? "I have paid" : "Ask staff to collect payment"}</button>
    </div>);
}
