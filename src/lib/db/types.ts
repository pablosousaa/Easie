import type { PostingStatus, ProductStatus } from "@/lib/types";

export type UserRow = {
  id: string;
  name: string;
  username: string;
  /** Legacy; may be empty after username migration. */
  email: string;
  password_hash: string;
  repost_window_days: number;
  created_at: string;
};

export type ProductRow = {
  id: string;
  user_id: string;
  affiliate_link: string;
  name: string;
  price: string;
  free_shipping: number;
  fast_delivery: number;
  status: ProductStatus;
  queue_order: number;
  created_at: string;
  completed_at: string | null;
  clicks: number;
  sales: number;
  commission: string;
  category: string;
};

export type TemplateRow = {
  id: string;
  user_id: string;
  name: string;
  content: string;
  is_default: number;
  updated_at: string;
  category: string;
};

export type GroupRow = {
  id: string;
  user_id: string;
  name: string;
  link: string;
  theme: string;
  rules: string;
  active: number;
  created_at: string;
};

export type PostingRow = {
  id: string;
  user_id: string;
  product_id: string;
  group_id: string;
  status: PostingStatus;
  variation_text: string;
  variation_index: number;
  posted_at: string | null;
  created_at: string;
};
