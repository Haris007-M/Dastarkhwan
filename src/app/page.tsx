import Link from "next/link";
import Image from "next/image";
import { QrCode, MessageCircle, Pencil } from "lucide-react";
const perks = [[QrCode, "Scan and browse", "One QR code on every table opens your live menu."], [MessageCircle, "Orders on WhatsApp", "The cart arrives in your own WhatsApp, fully written out."], [Pencil, "Edit anytime", "Change prices and mark items sold out from your phone."]] as const;
export default function Home() {
  return (
    <main className="mx-auto max-w-md">
      <div className="relative h-72"><Image src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900" alt="Restaurant table" fill priority sizes="448px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-pine to-pine/10" />
        <h1 className="absolute bottom-5 left-5 right-5 text-3xl font-bold leading-tight text-white">Dastarkhwan<span className="mt-1 block text-base font-medium text-white/80">Your menu, one scan away. Orders land on WhatsApp.</span></h1></div>
      <div className="space-y-3 p-5">
        {perks.map(([Icon, t, d]) => <div key={t} className="flex gap-3 rounded-2xl bg-white p-4"><Icon className="mt-0.5 shrink-0" size={22} /><div><p className="font-semibold">{t}</p><p className="text-sm text-pine/70">{d}</p></div></div>)}
        <Link href="/demo" className="btn block text-center">See the demo menu</Link>
        <Link href="/admin" className="block rounded-xl border border-pine/20 py-2.5 text-center text-sm font-semibold">Restaurant owner login</Link>
      </div>
    </main>);
}
