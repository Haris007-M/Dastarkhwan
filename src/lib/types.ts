export type Restaurant = { id: string; slug: string; name: string; whatsapp: string; tagline: string | null; banner_url: string | null; color: string; delivery_fee: number; payment_info: string | null };
export type Category = { id: string; name: string; sort: number };
export type Item = { id: string; category_id: string; name: string; description: string | null; price: number; image_url: string | null; available: boolean };
