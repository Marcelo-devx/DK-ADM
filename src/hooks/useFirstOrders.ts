import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FirstOrderData {
  order_id: number;
  created_at: string;
  orders: {
    total_price: number;
    status: string;
    user_id: string;
    profiles: {
      first_name: string | null;
      last_name: string | null;
    } | null;
  } | null;
}

const fetchFirstOrders = async () => {
  // Fetch primeiros_pedidos, joining with orders and profiles
  // Note: We rely on RLS policies to ensure only admins can read this data.
  const { data, error } = await supabase
    .from("primeiros_pedidos")
    .select(`
      order_id,
      created_at,
      orders (
        total_price,
        status,
        user_id,
        profiles (first_name, last_name)
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as unknown as FirstOrderData[];
};

export const useFirstOrders = () => {
  return useQuery<FirstOrderData[]>({
    queryKey: ["firstOrders"],
    queryFn: fetchFirstOrders,
    // Refetch frequently since this is a real-time alert/display
    refetchInterval: 15000, // 15 seconds
  });
};