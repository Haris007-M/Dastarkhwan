/** @type {import('next').NextConfig} */
export default {
  images: { formats: ["image/avif", "image/webp"], remotePatterns: [{ protocol: "https", hostname: "**" }] },
  async headers() { return [{ source: "/(.*)", headers: [{ key: "X-Frame-Options", value: "DENY" }, { key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] }]; },
};
