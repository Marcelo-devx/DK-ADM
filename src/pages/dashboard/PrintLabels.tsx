"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileSpreadsheet, Download, Search, Loader2, CheckSquare, Square, FileDown } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Configurações do Remetente (Estado Local - Carregado do Banco)
  const [senderInfo, setSenderInfo] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    cep: ""
  });

  // 1. Buscar Configurações do Remetente (Silencioso para uso na exportação)
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

  // 2. Buscar Pedidos (Com perfis e e-mails)
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["ordersForExcelExport"],
    queryFn: async () => {
      // Pedidos Pagos e Pendentes de Envio
      const { data: ordersData, error } = await supabase
        .from("orders")
        .select(`
          id, created_at, total_price, status, delivery_status, shipping_address, user_id,
          profiles (first_name, last_name, phone, cpf_cnpj)
        `)
        .in("status", ["Finalizada", "Pago"])
        .eq("delivery_status", "Pendente")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar emails via edge function
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

  // Filtragem local
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter(o => {
      const term = searchTerm.toLowerCase();
      return (
        String(o.id).includes(term) ||
        o.profiles?.first_name?.toLowerCase().includes(term) ||
        o.profiles?.last_name?.toLowerCase().includes(term)
      );
    });
  }, [orders, searchTerm]);

  // Seleção
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const toggleSelectOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Funções Auxiliares
  const cleanStr = (val: string | null | undefined) => val || "";
  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  // GERAR EXCEL
  const handleExport = () => {
    if (selectedIds.size === 0) {
      showError("Selecione pelo menos um pedido.");
      return;
    }

    setIsExporting(true);
    try {
      const selectedOrders = orders?.filter(o => selectedIds.has(o.id)) || [];

      const exportData = selectedOrders.map(order => {
        const p = order.profiles;
        const addr = order.shipping_address || {};
        const fullName = `${cleanStr(p?.first_name)} ${cleanStr(p?.last_name)}`.trim();

        return {
          "Número pedido": order.id,
          "Nome Entrega": fullName,
          "Endereço": `${addr.street || ''}, ${addr.number || ''}`,
          "Complemento Entrega": addr.complement || "",
          "Observações": "",
          "Telefone Comprador": p?.phone || "",
          "Comprador": fullName,
          "F": "",
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
      XLSX.utils.book_append_sheet(workbook, worksheet, "Envios");
      
      const fileName = `Envios_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      showSuccess(`${selectedOrders.length} pedidos exportados!`);
    } catch (err) {
      console.error(err);
      showError("Erro ao gerar Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  // BAIXAR EXEMPLO
  const handleDownloadTemplate = () => {
    const headers = [
      {
        "Número pedido": "12345",
        "Nome Entrega": "João Silva",
        "Endereço": "Rua das Flores, 123",
        "Complemento Entrega": "Apto 101",
        "Observações": "Frágil",
        "Telefone Comprador": "11999999999",
        "Comprador": "João Silva",
        "F": "",
        "Bairro Entrega": "Centro",
        "Cidade Entrega": "São Paulo",
        "CEP Entrega": "01000-000",
        "CPF/CNPJ Comprador": "123.456.789-00",
        "E-mail Comprador": "joao@email.com",
        "Remetente": "Minha Loja",
        "Endereço Remetente": "Av Paulista, 1000",
        "Cidade Remetente": "São Paulo",
        "Estado Remetente": "SP",
        "CEP Remetente": "01310-100"
      }
    ];
    
    const worksheet = XLSX.utils.json_to_sheet(headers);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo");
    XLSX.writeFile(workbook, "modelo_envios.xlsx");
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-8 w-8 text-green-600" />
          Exportação de Etiquetas
        </h1>
        <p className="text-muted-foreground">
          Gere planilhas para envio com dados completos de remetente e destinatário.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: APENAS OS BOTÕES DE AÇÃO */}
        <div className="lg:col-span-1">
            <Card>
                <CardContent className="p-4 space-y-4">
                    <Button variant="outline" className="w-full justify-start h-12" onClick={handleDownloadTemplate}>
                        <FileDown className="w-5 h-5 mr-3 text-gray-500" />
                        Baixar Planilha de Exemplo
                    </Button>
                </CardContent>
            </Card>
        </div>

        {/* Tabela de Pedidos Removida conforme solicitado */}
        
      </div>
    </div>
  );
}