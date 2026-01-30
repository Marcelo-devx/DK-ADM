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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: APENAS OS BOTÕES DE AÇÃO */}
        <div className="lg:col-span-1">
            <Card>
                <CardContent className="p-4 space-y-4">
                    <Button variant="outline" className="w-full justify-start h-12" onClick={handleDownloadTemplate}>
                        <FileDown className="w-5 h-5 mr-3 text-gray-500" />
                        Baixar Planilha de Exemplo
                    </Button>
                    <Button 
                        className="w-full justify-start h-12 bg-green-500 hover:bg-green-600 text-white font-bold"
                        onClick={handleExport}
                        disabled={selectedIds.size === 0 || isExporting}
                    >
                        {isExporting ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <Download className="w-5 h-5 mr-3" />}
                        Exportar Selecionados ({selectedIds.size})
                    </Button>
                </CardContent>
            </Card>
        </div>

        {/* COLUNA DIREITA: LISTA DE PEDIDOS */}
        <div className="lg:col-span-2">
            <Card className="h-full flex flex-col">
                <CardHeader className="pb-3 border-b bg-gray-50/50">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <CardTitle className="text-lg">Pedidos Pendentes</CardTitle>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                                placeholder="Filtrar por nome ou ID..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-8 h-9 text-sm bg-white"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                    <div className="overflow-auto max-h-[600px]">
                        <Table>
                            <TableHeader className="bg-white sticky top-0 shadow-sm z-10">
                                <TableRow>
                                    <TableHead className="w-10 text-center">
                                        <button onClick={toggleSelectAll}>
                                            {filteredOrders.length > 0 && selectedIds.size === filteredOrders.length ? (
                                                <CheckSquare className="w-5 h-5 text-primary" />
                                            ) : (
                                                <Square className="w-5 h-5 text-gray-400" />
                                            )}
                                        </button>
                                    </TableHead>
                                    <TableHead>Pedido</TableHead>
                                    <TableHead>Destinatário</TableHead>
                                    <TableHead>Cidade/UF</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({length: 5}).map((_, i) => (
                                        <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-12 w-full" /></TableCell></TableRow>
                                    ))
                                ) : filteredOrders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                            Nenhum pedido pendente encontrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredOrders.map(order => {
                                        const isSelected = selectedIds.has(order.id);
                                        const addr = order.shipping_address || {};
                                        return (
                                            <TableRow 
                                                key={order.id} 
                                                className={`cursor-pointer transition-colors ${isSelected ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-50'}`}
                                                onClick={() => toggleSelectOne(order.id)}
                                            >
                                                <TableCell className="text-center">
                                                    {isSelected ? <CheckSquare className="w-5 h-5 text-green-600" /> : <Square className="w-5 h-5 text-gray-300" />}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-mono font-bold">#{order.id}</span>
                                                    <div className="text-[10px] text-gray-500">{new Date(order.created_at).toLocaleDateString('pt-BR')}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-medium text-sm">
                                                        {order.profiles?.first_name} {order.profiles?.last_name}
                                                    </span>
                                                    <div className="text-xs text-gray-500">{order.profiles?.phone}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm">{addr.neighborhood}</div>
                                                    <div className="text-xs text-gray-500">{addr.city}/{addr.state}</div>
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-gray-700">
                                                    {formatCurrency(order.total_price)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}