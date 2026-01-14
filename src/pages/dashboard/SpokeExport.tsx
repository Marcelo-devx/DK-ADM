"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileDown, Map as MapIcon, Loader2, RefreshCw, Filter, Truck, CalendarClock } from "lucide-react";
import * as XLSX from 'xlsx';
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Order {
  id: number;
  created_at: string;
  total_price: number;
  status: string;
  delivery_status: string;
  shipping_address: any;
  user_id: string;
  email?: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
}

// Função para verificar se o pedido caiu na próxima rota
const checkIsNextRoute = (dateString: string) => {
  const orderDate = new Date(dateString);
  const day = orderDate.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado

  // Cria data de corte baseada no dia do pedido
  const cutoff = new Date(orderDate);
  cutoff.setSeconds(0);
  cutoff.setMilliseconds(0);

  if (day === 0) {
    // Domingo: Tudo vai para próxima rota (Segunda)
    return true;
  } else if (day === 6) {
    // Sábado: Corte às 12:30
    cutoff.setHours(12, 30, 0);
  } else {
    // Segunda a Sexta: Corte às 14:00
    cutoff.setHours(14, 0, 0);
  }

  // Se o pedido foi feito DEPOIS do corte, é próxima rota
  return orderDate > cutoff;
};

const fetchOrdersToExport = async (): Promise<Order[]> => {
  // Busca apenas pedidos que já foram pagos/finalizados e ainda não foram entregues
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, created_at, total_price, status, delivery_status, user_id, shipping_address")
    .in("status", ["Finalizada", "Pago"]) // Apenas pagos
    .in("delivery_status", ["Pendente", "Aguardando Coleta"]) // Apenas não entregues
    .order("created_at", { ascending: false });

  if (ordersError) throw new Error(ordersError.message);
  if (!orders) return [];

  const userIds = [...new Set(orders.map(o => o.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, phone")
    .in("id", userIds);

  if (profilesError) throw new Error(profilesError.message);
  const profilesMap = new Map(profiles.map(p => [p.id, p]));

  // Busca emails usando a função existente
  let emailsMap = new Map<string, string>();
  try {
      const { data: usersData, error: usersError } = await supabase.functions.invoke("get-users");
      if (!usersError && usersData) {
          usersData.forEach((u: any) => {
              emailsMap.set(u.id, u.email);
          });
      }
  } catch (e) {
      console.error("Failed to fetch emails", e);
  }

  return orders.map(order => ({
    ...order,
    email: emailsMap.get(order.user_id) || "",
    profiles: profilesMap.get(order.user_id) || null,
  })) as Order[];
};

const SpokeExportPage = () => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const { data: orders, isLoading, refetch, isRefetching } = useQuery<Order[]>({
    queryKey: ["ordersToExport"],
    queryFn: fetchOrdersToExport,
  });

  const toggleSelectAll = () => {
    if (orders && selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders?.map(o => o.id)));
    }
  };

  const toggleSelectOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const cleanDigits = (val: string | null | undefined) => {
    if (!val) return "";
    return val.replace(/\D/g, "");
  };

  const handleExport = () => {
    if (selectedIds.size === 0) {
      showError("Selecione pelo menos um pedido para exportar.");
      return;
    }

    setIsExporting(true);
    try {
      const selectedOrders = orders?.filter(o => selectedIds.has(o.id)) || [];

      // Mapeia os dados para o formato exato solicitado
      const exportData = selectedOrders.map(order => {
        const address = order.shipping_address || {};
        const profile = order.profiles;
        
        const firstName = profile?.first_name || '';
        const lastName = profile?.last_name || '';
        const phoneRaw = profile?.phone || '';
        const phoneClean = cleanDigits(phoneRaw);
        
        const fullName = `${firstName} ${lastName}`.trim();
        const addressLine1 = `${address.street}, ${address.number}`;
        const zipClean = cleanDigits(address.cep);
        
        // Formato: wa.me/55 + numero (apenas digitos)
        const notes = phoneClean ? `wa.me/55${phoneClean}` : "";

        return {
          "Address Line 1": addressLine1,
          "Address Line 2": address.complement || "",
          "City": address.city || "",
          "Zip": zipClean,
          "Notes": notes,
          "Recipient Name": fullName || "Cliente",
          "Recipient Email Address": order.email || "",
          "Recipient Phone Number": phoneClean,
          "Id": order.id
        };
      });

      // Cria a planilha
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Rota Spoke");

      // Gera o nome do arquivo com data e hora
      const fileName = `Rota_Spoke_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`;

      // Download
      XLSX.writeFile(workbook, fileName);
      showSuccess(`${selectedOrders.length} pedidos exportados com sucesso!`);
      
    } catch (err) {
      console.error(err);
      showError("Erro ao gerar a planilha.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MapIcon className="h-8 w-8 text-blue-600" />
            Exportar para Spoke
          </h1>
          <p className="text-muted-foreground text-sm">Gere planilhas de rota compatíveis com o aplicativo Spoke/Circuit.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
                <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} /> Atualizar Lista
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
            <Card className="border-none shadow-md">
                <CardHeader className="bg-gray-50/50 border-b py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Truck className="h-4 w-4" /> Pedidos Prontos para Envio
                    </CardTitle>
                    <Badge variant="secondary" className="bg-white border">{orders?.length || 0} encontrados</Badge>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[600px] overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="w-12 text-center">
                                        <Checkbox 
                                            checked={orders && orders.length > 0 && selectedIds.size === orders.length}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>Pedido & Data</TableHead>
                                    <TableHead>Destinatário</TableHead>
                                    <TableHead>Bairro/Cidade</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center">Carregando pedidos...</TableCell></TableRow>
                                ) : orders && orders.length > 0 ? (
                                    orders.map(order => {
                                        const isNextRoute = checkIsNextRoute(order.created_at);
                                        const isSelected = selectedIds.has(order.id);

                                        return (
                                            <TableRow 
                                                key={order.id} 
                                                className={cn(
                                                    "cursor-pointer hover:bg-blue-50/50",
                                                    isSelected ? "bg-blue-50" : "",
                                                    isNextRoute ? "bg-yellow-50/60 border-l-4 border-l-yellow-400" : ""
                                                )}
                                                onClick={() => toggleSelectOne(order.id)}
                                            >
                                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox 
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleSelectOne(order.id)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-mono font-bold text-sm">#{order.id}</span>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {new Date(order.created_at).toLocaleString("pt-BR")}
                                                        </span>
                                                        {isNextRoute && (
                                                            <Badge variant="outline" className="mt-1 w-fit text-[9px] bg-yellow-100 text-yellow-800 border-yellow-300 gap-1 px-1">
                                                                <CalendarClock className="w-3 h-3" /> Próx. Dia
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-sm">{order.profiles?.first_name} {order.profiles?.last_name}</span>
                                                        <span className="text-xs text-muted-foreground">{order.profiles?.phone || "-"}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm">{order.shipping_address?.neighborhood}</span>
                                                        <span className="text-xs text-muted-foreground">{order.shipping_address?.city}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-xs">
                                                    R$ {order.total_price.toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Nenhum pedido pendente encontrado.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div>
            <Card className="sticky top-6 border-blue-200 bg-blue-50/30 shadow-lg">
                <CardHeader>
                    <CardTitle className="text-lg text-blue-800">Resumo da Exportação</CardTitle>
                    <CardDescription>Arquivo formatado para importação direta.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-white p-4 rounded-lg border flex flex-col gap-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Pedidos Selecionados:</span>
                            <span className="font-bold">{selectedIds.size}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-2">
                            <span className="text-muted-foreground">Formato:</span>
                            <span className="font-bold text-green-600">.XLSX (Excel)</span>
                        </div>
                    </div>

                    <Button 
                        className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-lg"
                        onClick={handleExport}
                        disabled={selectedIds.size === 0 || isExporting}
                    >
                        {isExporting ? (
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>
                        ) : (
                            <><FileDown className="mr-2 h-5 w-5" /> Baixar Planilha</>
                        )}
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground px-4">
                        Dica: No Spoke, vá em "Adicionar Paradas" {'>'} "Carregar arquivo" e selecione este arquivo.
                    </p>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default SpokeExportPage;