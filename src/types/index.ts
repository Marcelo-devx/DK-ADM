export type UserRole = 'user' | 'adm';

export interface BaseProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  phone: string | null;
}

export interface Address {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  pix_price: number | null;
  cost_price: number | null;
  stock_quantity: number;
  category: string | null;
  sub_category: string | null;
  brand: string | null;
  image_url: string | null;
  is_visible: boolean;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  message?: string;
}