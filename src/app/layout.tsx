import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
const font = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
export const metadata: Metadata = { title: "Dastarkhwan: QR menus that take WhatsApp orders", description: "Digital menu and WhatsApp ordering for restaurants and bakeries." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#14342b" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={font.className}>{children}</body></html>;
}
