import { apiClient } from "@/api/client";
import { Product } from "@/types";

export const productService = {
  async getAll(): Promise<Product[]> {
    const response = await apiClient.invoke<Product[]>("catalog-api", { action: "list_products" });
    if (response.error) throw new Error(response.error);
    return response.data || [];
  },

  async create(product: Partial<Product>): Promise<void> {
    const response = await apiClient.invoke("catalog-api", { action: "create_product", data: product });
    if (response.error) throw new Error(response.error);
  },

  async update(id: number, product: Partial<Product>): Promise<void> {
    const response = await apiClient.invoke("catalog-api", { action: "update_product", id, data: product });
    if (response.error) throw new Error(response.error);
  },

  async delete(id: number): Promise<void> {
    const response = await apiClient.invoke("catalog-api", { action: "delete_product", id });
    if (response.error) throw new Error(response.error);
  }
};