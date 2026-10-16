"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/browser";
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [msg, setMsg] = useState("");
  const go = async (up: boolean) => {
    const { error } = up ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMsg(error.message);
    if (up) setMsg("Account created. If email confirmation is on, confirm it, then log in."); else { router.replace("/admin"); router.refresh(); }
  };
  return (
    <main className="mx-auto mt-20 max-w-sm space-y-3 p-5">
      <h1 className="text-2xl font-bold">Owner login</h1>
      <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="input" type="password" placeholder="Password (6+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <button className="btn w-full" onClick={() => go(false)}>Log in</button>
      <button className="w-full rounded-xl border border-pine/20 py-2.5 text-sm font-semibold" onClick={() => go(true)}>Create account</button>
    </main>);
}
