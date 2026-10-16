import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Menu from "./Menu";
import type { Restaurant, Category, Item } from "@/lib/types";
export const revalidate = 60;
export default async function Page({ params }: { params: { slug: string } }) {
  const { data: r } = await supabase.from("restaurants").select("*").eq("slug", params.slug).maybeSingle();
  if (!r) notFound();
  const [c, i] = await Promise.all([
    supabase.from("categories").select("id,name,sort").eq("restaurant_id", r.id).order("sort"),
    supabase.from("items").select("*").eq("restaurant_id", r.id).order("name")]);
  return <Menu r={r as Restaurant} cats={(c.data ?? []) as Category[]} items={(i.data ?? []) as Item[]} />;
}
