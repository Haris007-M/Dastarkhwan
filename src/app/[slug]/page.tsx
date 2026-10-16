import { notFound } from "next/navigation";
import { supabase, envReady } from "@/lib/supabase";
import Menu from "./Menu";
import type { Restaurant, Category, Item } from "@/lib/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Page({ params }: { params: { slug: string } }) {
  if (!envReady) return <p className="p-8 text-center text-sm">Supabase keys are missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your hosting settings, then redeploy.</p>;
  const { data: r } = await supabase.from("restaurants").select("*").eq("slug", params.slug).maybeSingle();
  if (!r) notFound();
  const [c, i] = await Promise.all([
    supabase.from("categories").select("id,name,sort").eq("restaurant_id", r.id).order("sort"),
    supabase.from("items").select("*").eq("restaurant_id", r.id).order("name")]);
  return <Menu r={r as Restaurant} cats={(c.data ?? []) as Category[]} items={(i.data ?? []) as Item[]} />;
}
