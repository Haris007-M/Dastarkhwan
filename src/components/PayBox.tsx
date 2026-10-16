"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { shrink } from "@/lib/shrink";
const METHODS = ["Cash", "Easypaisa", "JazzCash", "Bank transfer", "Card"];
type Row = { total: number; pay_batch: string | null; pay_method: string | null };
type P = { rid: string; slug: string; table: string; session: string; code: string | null; rows: Row[]; info: string | null; onDone: () => void };

export default function PayBox({ rid, slug, table, session, code, rows, info, onDone }: P) {
  const [open, setOpen] = useState(false); const [m, setM] = useState("Cash"); const [ref, setRef] = useState("");
  const [file, setFile] = useState<File | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const batches = Object.values(rows.filter((r) => r.pay_batch).reduce<Record<string, { id: string; method: string; total: number }>>((a, r) => { const b = (a[r.pay_batch!] ||= { id: r.pay_batch!, method: r.pay_method ?? "", total: 0 }); b.total += r.total; return a; }, {}));
  const due = rows.filter((r) => !r.pay_batch).reduce((s, r) => s + r.total, 0);
  const digital = m !== "Cash" && m !== "Card";
  const cancel = async (id: string) => { setBusy(true); await supabase.rpc("cancel_payment", { p_slug: slug, p_batch: id }); setBusy(false); onDone(); };
  const send = async () => {
    setBusy(true); setErr("");
    try {
      let proof = "";
      if (digital) {
        if (!file) throw new Error("Add your payment screenshot first");
        proof = `${rid}/${crypto.randomUUID()}.webp`;
        const up = await supabase.storage.from("payment-proofs").upload(proof, await shrink(file), { contentType: "image/webp" });
        if (up.error) throw up.error;
      }
      const { error } = await supabase.rpc("request_payment", { p_slug: slug, p_table: table, p_session: session, p_code: code ?? "", p_method: m, p_ref: ref, p_proof: proof });
      if (error) throw error;
      setOpen(false); setFile(null); setRef(""); onDone();
    } catch (e) { setErr((e as { message?: string }).message ?? "Something went wrong"); }
    setBusy(false);
  };
  return (
    <div className="space-y-2">
      {batches.map((b) => (
        <div key={b.id} className="rounded-xl bg-amber-100 p-2 text-sm">
          <p className="font-semibold">Rs. {b.total} sent by {b.method}. Waiting for the restaurant to confirm.</p>
          <button disabled={busy} onClick={() => cancel(b.id)} className="mt-1 text-xs font-semibold underline">Change payment method</button>
        </div>))}
      {due > 0 && (!open ? <button onClick={() => setOpen(true)} className="btn w-full">{batches.length ? `Pay the rest: Rs. ${due}` : `Pay Rs. ${due}`}</button> : (
        <div className="space-y-2 rounded-xl border border-pine/20 p-2">
          <div className="grid grid-cols-3 gap-1">{METHODS.map((x) => <button key={x} onClick={() => setM(x)} className={`rounded-lg py-1.5 text-xs font-semibold ${m === x ? "bg-pine text-white" : "bg-chalk"}`}>{x}</button>)}</div>
          {digital ? <>
            {info && <p className="whitespace-pre-line rounded-lg bg-chalk p-2 text-xs">{info}</p>}
            <p className="text-xs">Send Rs. {due}, then upload the screenshot of your payment.</p>
            <label className="block cursor-pointer rounded-xl border border-dashed border-pine/40 p-3 text-center text-sm font-medium"><input type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />{file ? `Selected: ${file.name}` : "Upload payment screenshot"}</label>
            <input className="input" placeholder="Transaction ID (optional)" value={ref} onChange={(e) => setRef(e.target.value)} /></>
            : <p className="text-xs">Staff will come to take Rs. {due} ({m.toLowerCase()}).</p>}
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button disabled={busy || (digital && !file)} onClick={send} className="btn w-full">{busy ? "Sending…" : digital ? "I have paid" : "Ask staff to collect payment"}</button>
          <button onClick={() => setOpen(false)} className="w-full text-xs underline">Cancel</button>
        </div>))}
    </div>);
}
