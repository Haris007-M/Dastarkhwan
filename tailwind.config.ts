import type { Config } from "tailwindcss";
export default { content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { pine: "#14342b", chalk: "#f5f6f2", brand: "var(--brand)" } } }, plugins: [] } satisfies Config;
