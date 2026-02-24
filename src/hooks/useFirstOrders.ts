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
  // 1. Busca primeiros_pedidos junto com dados básicos do pedido (sem tentar join profundo com profiles que causa erro 400)
  const { data: firstOrdersData, error: firstOrdersError } = await supabase
    .from("primeiros_pedidos")
    .select(`
      order_id,
      created_at,
      orders (
        total_price,
        status,
        user_id
      )
    `)
    .order("created_at", { ascending: false });

  if (firstOrdersError) throw new Error(firstOrdersError.message);
  if (!firstOrdersData) return [];

  // 2. Extrai os IDs dos usuários para buscar os nomes separadamente
  // (Isso contorna o problema de relacionamento direto não encontrado)
  const userIds = firstOrdersData
    .map((item: any) => item.orders?.user_id)
    .filter((id: string) => id);

  if (userIds.length === 0) return firstOrdersData as unknown as FirstOrderData[];

  // 3. Busca os perfis
  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", userIds);

  if (profilesError) throw new Error(profilesError.message);

  // 4. Mapeia os perfis de volta aos pedidos
  const profilesMap = new Map(profilesData?.map(p => [p.id, p]));

  const result = firstOrdersData.map((item: any) => {
    const order = item.orders;
    if (!order) return item;

    const profile = profilesMap.get(order.user_id);
    return {
      ...item,
      orders: {
        ...order,
        profiles: profile ? { first_name: profile.first_name, last_name: profile.last_name } : null
      }
    };
  });

  return result as FirstOrderData[];
};

export const useFirstOrders = () => {
  return useQuery<FirstOrderData[]>({
    queryKey: ["firstOrders"],
    queryFn: fetchFirstOrders,
    // Refetch frequently since this is a real-time alert/display
    refetchInterval: 15000, // 15 seconds
  });
};