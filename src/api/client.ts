import { supabase } from "@/integrations/supabase/client";
import { ApiResponse } from "@/types";

/**
 * Encapsulamento de chamadas para a API (Edge Functions).
 * Nenhuma chamada direta ao banco de dados deve ser feita pelo frontend.
 */
export const apiClient = {
  async invoke<T>(functionName: string, body?: any): Promise<ApiResponse<T>> {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
      });

      if (error) {
        console.error(`[API Error] ${functionName}:`, error);
        return { data: null, error: error.message || 'Falha na comunicação com o servidor.' };
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Erro inesperado.' };
    }
  }
};