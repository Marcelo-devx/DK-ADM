"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2, PackageCheck } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import * as XLSX from 'xlsx';
import { format } from "date-fns";

// --- Tipos ---
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
    cpf_cnpj: string | null;
  } | null;
}

export default function PrintLabelsPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [senderInfo, setSenderInfo] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    cep: ""
  });

  // 1. Buscar Configurações do Remetente (Silencioso)
  useQuery({
    queryKey: ["senderSettingsExport"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["sender_name", "sender_address", "sender_city", "sender_state", "sender_cep"]);
      
      const settings: any = {};
      data?.forEach(s => settings[s.key] = s.value);
      
      setSenderInfo({
        name: settings.sender_name || "Minha Loja",
        address: settings.sender_address || "",
        city: settings.sender_city || "",
        state: settings.sender_state || "",
        cep: settings.sender_cep || ""
      });
      return settings;
    }
  });

  // 2. Buscar Pedidos Pendentes de Envio
  const { data: pendingOrders, isLoading } = useQuery<Order[]>({
    queryKey: ["pendingOrdersForLabels"],
    queryFn: async () => {
      const { data: ordersData, error } = await supabase
        .from("orders")
        .select(`
          id, created_at, total_price, status, delivery_status, shipping_address, user_id,
          profiles (first_name, last_name, phone, cpf_cnpj)
        `)
        .in("status", ["Finalizada", "Pago"])
        .eq("delivery_status", "Pendente")
        .order("created_at", { ascending: true }); // Mais antigos primeiro

      if (error) throw error;

      // Buscar emails
      let emailMap = new Map<string, string>();
      try {
          const { data: usersData } = await supabase.functions.invoke("get-users");
          if (usersData) {
              usersData.forEach((u: any) => emailMap.set(u.id, u.email));
          }
      } catch (e) {
          console.error("Erro ao buscar emails", e);
      }

      return ordersData.map((o: any) => ({
          ...o,
          email: emailMap.get(o.user_id) || ""
      }));
    },
  });

  // Funções Auxiliares
  const cleanStr = (val: string | null | undefined) => val || "";

  // GERAR RELATÓRIO REAL
  const handleGenerateReport = () => {
    if (!pendingOrders || pendingOrders.length === 0) {
      showError("Não há pedidos pendentes para gerar etiquetas.");
      return;
    }

    setIsExporting(true);
    try {
      const exportData = pendingOrders.map(order => {
        const p = order.profiles;
        const addr = order.shipping_address || {};
        const fullName = `${cleanStr(p?.first_name)} ${cleanStr(p?.last_name)}`.trim();

        // Mapeamento EXATO conforme o modelo solicitado
        return {
          "Número pedido": order.id,
          "Nome Entrega": fullName,
          "Endereço": `${addr.street || ''}, ${addr.number || ''}`,
          "Complemento Entrega": addr.complement || "",
          "Observações": "", // Campo fixo conforme modelo
          "Telefone Comprador": p?.phone || "",
          "Comprador": fullName,
          "F": "", // Campo fixo conforme modelo
          "Bairro Entrega": addr.neighborhood || "",
          "Cidade Entrega": addr.city || "",
          "CEP Entrega": addr.cep || "",
          "CPF/CNPJ Comprador": p?.cpf_cnpj || "",
          "E-mail Comprador": order.email || "",
          
          // Dados do Remetente (Automáticos do Banco)
          "Remetente": senderInfo.name,
          "Endereço Remetente": senderInfo.address,
          "Cidade Remetente": senderInfo.city,
          "Estado Remetente": senderInfo.state,
          "CEP Remetente": senderInfo.cep
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Etiquetas");
      
      const fileName = `Etiquetas_Envio_${format(new Date(), "dd-MM-yyyy_HH-mm")}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      showSuccess(`${pendingOrders.length} etiquetas geradas com sucesso!`);
    } catch (err) {
      console.error(err);
      showError("Erro ao gerar o arquivo Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-8 w-8 text-green-600" />
          Exportação de Etiquetas
        </h1>
        <p className="text-muted-foreground">
          Gere o arquivo Excel formatado para impressão de etiquetas com dados completos de remetente e destinatário.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-green-200 bg-green-50/20 shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Relatório de Envio</span>
                    {isLoading ? (
                        <Skeleton className="h-6 w-20" />
                    ) : (
                        <span className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-full border border-green-200">
                            {pendingOrders?.length || 0} Pendentes
                        </span>
                    )}
                </CardTitle>
                <CardDescription>
                    Este botão processa todos os pedidos com pagamento confirmado que ainda não foram enviados e gera a planilha no formato padrão.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button 
                    onClick={handleGenerateReport} 
                    disabled={isExporting || isLoading || !pendingOrders || pendingOrders.length === 0} 
                    className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 shadow-md"
                >
                    {isExporting ? (
                        <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Gerando Arquivo...</>
                    ) : (
                        <><PackageCheck className="w-6 h-6 mr-2" /> Gerar Arquivo de Etiquetas</>
                    )}
                </Button>
                {(!pendingOrders || pendingOrders.length === 0) && !isLoading && (
                    <p className="text-center text-sm text-muted-foreground mt-3">
                        Não há pedidos aguardando envio no momento.
                    </p>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}