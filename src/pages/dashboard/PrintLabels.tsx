"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileSpreadsheet, FileDown, Download, Loader2, Trash2 } from "lucide-react";
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
  delivery_status: string | null;
  shipping_address: any;
  user_id: string | null;
  email?: string;
  delivery_info?: string | null;
  profiles?: {
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
  const REMOVED_STORAGE_KEY = "print_labels_removed_orders_v1";
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());

  // Export confirmation dialog state
  const [isExportConfirmOpen, setIsExportConfirmOpen] = useState(false);
  const [exportPreviewOrders, setExportPreviewOrders] = useState<Order[]>([]);

  const refetchRef = useRef<(() => Promise<any>) | undefined>(undefined);

  // Load removed order ids from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(REMOVED_STORAGE_KEY);
      if (raw) {
        const parsed: number[] = JSON.parse(raw);
        setRemovedIds(new Set(parsed));
      }
    } catch (e) {
      console.error("Erro ao carregar pedidos removidos do localStorage", e);
    }
  }, []);

  const persistRemovedIds = (next: Set<number>) => {
    try {
      localStorage.setItem(REMOVED_STORAGE_KEY, JSON.stringify(Array.from(next)));
    } catch (e) {
      console.error("Erro ao persistir pedidos removidos", e);
    }
  };

  // Buscar Pedidos
  const { data: orders, isLoading, refetch } = useQuery<Order[]>({
    queryKey: ["ordersForExcelExport"],
    queryFn: async () => {
      const { data: ordersData, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          total_price,
          status,
          delivery_status,
          shipping_address,
          user_id,
          delivery_info
        `)
        .in("status", ["Finalizada", "Pago"])
        .in("delivery_status", ["Aguardando Coleta", "Pendente", "Embalado", "Despachado"])
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar pedidos para export:", error);
        throw error;
      }

      if (!ordersData || ordersData.length === 0) return [];

      const userIds = Array.from(new Set(ordersData.map((o: any) => o.user_id).filter(Boolean)));
      let profilesMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, phone, cpf_cnpj")
          .in("id", userIds);

        if (!profilesError && profilesData) {
          profilesData.forEach((p: any) => profilesMap.set(String(p.id), p));
        } else if (profilesError) {
          console.error("Erro ao buscar perfis:", profilesError);
        }
      }

      // Buscar emails via RPC (função SQL com SECURITY DEFINER que acessa auth.users)
      let emailMap = new Map<string, string>();
      try {
        const { data: emailsData, error: emailsError } = await supabase.rpc("get_users_emails_by_ids", {
          user_ids: userIds
        });
        if (emailsError) {
          console.error("[PrintLabels] get_users_emails_by_ids RPC erro:", emailsError);
        } else if (Array.isArray(emailsData)) {
          emailsData.forEach((u: any) => {
            if (u.id && u.email) emailMap.set(u.id, u.email);
          });
          console.log(`[PrintLabels] Emails carregados via RPC: ${emailMap.size} de ${userIds.length}`);
        }
      } catch (e) {
        console.error("[PrintLabels] get_users_emails_by_ids falhou:", e);
      }

      return ordersData.map((o: any) => ({
        ...o,
        profiles: o.user_id ? profilesMap.get(String(o.user_id)) ?? null : null,
        email: o.user_id ? (emailMap.get(o.user_id) || "") : ""
      }));
    },
    staleTime: 0
  });

  refetchRef.current = refetch;

  // Filtragem local
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    const term = searchTerm.trim().toLowerCase();
    const base = orders.filter(o => !removedIds.has(o.id));
    if (!term) return base;
    return base.filter(o => {
      const p = o.profiles;
      return (
        String(o.id).includes(term) ||
        p?.first_name?.toLowerCase().includes(term) ||
        p?.last_name?.toLowerCase().includes(term) ||
        (o.email || "").toLowerCase().includes(term)
      );
    });
  }, [orders, searchTerm, removedIds]);

  const toggleSelectAll = () => {
    if (!orders) return;
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

  const handleClearSelected = () => {
    if (selectedIds.size === 0) {
      showError("Selecione pelo menos um pedido.");
      return;
    }
    const count = selectedIds.size;
    const next = new Set(removedIds);
    selectedIds.forEach(id => next.add(id));
    setRemovedIds(next);
    persistRemovedIds(next);
    setSelectedIds(new Set());
    showSuccess(`${count} pedido(s) removido(s) da lista.`);
  };

  const handleRefresh = async () => {
    try {
      if (refetchRef.current) {
        await refetchRef.current();
        showSuccess("Pedidos atualizados.");
      } else {
        showError("Não foi possível atualizar no momento.");
      }
    } catch (e) {
      console.error("Erro ao atualizar pedidos:", e);
      showError("Erro ao atualizar pedidos.");
    }
  };

  const cleanStr = (val: string | null | undefined) => val || "";

  const TEMPLATE_HEADERS = [
    "Número pedido",
    "Nome Entrega",
    "Endereço",
    "Complemento",
    "Entrega",
    "Observações",
    "Telefone",
    "Nota Circuit",
    "Bairro Entrega",
    "Cidade Entrega",
    "CEP Entrega",
    "CPF/CNPJ Comprador",
    "E-mail Comprador",
  ];

  const handleExport = () => {
    if (selectedIds.size === 0) {
      showError("Selecione pelo menos um pedido.");
      return;
    }

    const selectedOrders = (orders ?? []).filter(o => selectedIds.has(o.id) && !removedIds.has(o.id));
    if (selectedOrders.length === 0) {
      showError("Nenhum pedido selecionado disponível para exportação.");
      return;
    }

    setExportPreviewOrders(selectedOrders);
    setIsExportConfirmOpen(true);
  };

  const performExport = async (selectedOrders: Order[], removeAfterExport: boolean) => {
    setIsExporting(true);
    try {
      const exportData = selectedOrders.map(order => {
        const p = order.profiles;
        const addr = order.shipping_address || {};
        const fullName = `${cleanStr(p?.first_name)} ${cleanStr(p?.last_name)}`.trim();
        return {
          "Número pedido": order.id,
          "Nome Entrega": fullName,
          "Endereço": `${addr.street || ''}${addr.number ? `, ${addr.number}` : ''}`.trim(),
          "Complemento": addr.complement || "",
          "Entrega": "",
          "Observações": order.delivery_info || "",
          "Telefone": p?.phone || "",
          "Nota Circuit": "",
          "Bairro Entrega": addr.neighborhood || "",
          "Cidade Entrega": addr.city || "",
          "CEP Entrega": addr.cep || "",
          "CPF/CNPJ Comprador": p?.cpf_cnpj || "",
          "E-mail Comprador": order.email || "",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData, { header: TEMPLATE_HEADERS });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Envios");

      const fileName = `Envios_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      if (removeAfterExport) {
        const next = new Set(removedIds);
        selectedOrders.forEach(o => next.add(o.id));
        setRemovedIds(next);
        persistRemovedIds(next);
        const nextSelected = new Set(selectedIds);
        selectedOrders.forEach(o => nextSelected.delete(o.id));
        setSelectedIds(nextSelected);
      }

      showSuccess(`${selectedOrders.length} pedidos exportados!`);
    } catch (err) {
      console.error(err);
      showError("Erro ao gerar Excel.");
    } finally {
      setIsExporting(false);
      setIsExportConfirmOpen(false);
      setExportPreviewOrders([]);
    }
  };

  const handleDownloadTemplate = () => {
    const sample = [
      {
        "Número pedido": "12345",
        "Nome Entrega": "João Silva",
        "Endereço": "Rua das Flores, 123",
        "Complemento": "Apto 101",
        "Entrega": "",
        "Observações": "Frágil",
        "Telefone": "11999999999",
        "Nota Circuit": "",
        "Bairro Entrega": "Centro",
        "Cidade Entrega": "São Paulo",
        "CEP Entrega": "01000-000",
        "CPF/CNPJ Comprador": "123.456.789-00",
        "E-mail Comprador": "joao@email.com",
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sample, { header: TEMPLATE_HEADERS });
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
          Gere planilhas para envio com dados completos de destinatário.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-11 rounded-md" onClick={handleDownloadTemplate}>
              <FileDown className="w-4 h-4 mr-2 text-gray-500" />
              Baixar Planilha de Exemplo
            </Button>

            <Button
              className={`h-11 rounded-md ${selectedIds.size === 0 ? "opacity-60" : ""}`}
              onClick={handleExport}
              disabled={isExporting || selectedIds.size === 0}
            >
              {isExporting ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2" />}
              Exportar Selecionados ({selectedIds.size})
            </Button>

            {selectedIds.size > 0 && (
              <>
                <Button variant="outline" className="h-11" onClick={handleRefresh}>
                  <Loader2 className="w-4 h-4 mr-2" />
                  Atualizar
                </Button>
                <Button className="bg-red-600 hover:bg-red-700 text-white h-11" onClick={handleClearSelected}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Limpar da lista ({selectedIds.size})
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Pedidos prontos para etiqueta</CardTitle>
          <div className="flex items-center gap-2">
            <Input placeholder="Buscar por ID, nome ou e-mail" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-72" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          {isLoading ? (
            <div className="p-6"><Skeleton className="h-8 w-full mb-2" /><Skeleton className="h-8 w-full mb-2" /><Skeleton className="h-8 w-full" /></div>
          ) : (
            <div className="min-w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input type="checkbox" checked={selectedIds.size === filteredOrders.length && filteredOrders.length > 0} onChange={toggleSelectAll} />
                    </TableHead>
                    {TEMPLATE_HEADERS.map(h => (
                      <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={TEMPLATE_HEADERS.length + 1} className="py-10 text-center text-muted-foreground">Nenhum pedido encontrado com delivery_status 'Aguardando Coleta', 'Pendente' ou 'Embalado'.</TableCell>
                    </TableRow>
                  )}

                  {filteredOrders.map(order => {
                    const p = order.profiles;
                    const addr = order.shipping_address || {};
                    const fullName = `${cleanStr(p?.first_name)} ${cleanStr(p?.last_name)}`.trim();

                    const rowValues: Record<string, any> = {
                      "Número pedido": order.id,
                      "Nome Entrega": fullName,
                      "Endereço": `${addr.street || ''}${addr.number ? `, ${addr.number}` : ''}`.trim(),
                      "Complemento": addr.complement || "",
                      "Entrega": "",
                      "Observações": order.delivery_info || "",
                      "Telefone": p?.phone || "",
                      "Nota Circuit": "",
                      "Bairro Entrega": addr.neighborhood || "",
                      "Cidade Entrega": addr.city || "",
                      "CEP Entrega": addr.cep || "",
                      "CPF/CNPJ Comprador": p?.cpf_cnpj || "",
                      "E-mail Comprador": order.email || "",
                    };

                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => toggleSelectOne(order.id)} />
                        </TableCell>

                        {TEMPLATE_HEADERS.map(h => (
                          <TableCell key={h} className="whitespace-nowrap">{String(rowValues[h] ?? "")}</TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export confirmation dialog */}
      <Dialog open={isExportConfirmOpen} onOpenChange={setIsExportConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exportação</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div className="text-sm text-muted-foreground mb-3">Você está prestes a exportar {exportPreviewOrders.length} pedido(s). Escolha uma opção:</div>

            <div className="max-h-64 overflow-auto border rounded-md p-2 mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-2 pr-4">ID</th>
                    <th className="pb-2 pr-4">Endereço</th>
                    <th className="pb-2 pr-4">Telefone</th>
                    <th className="pb-2 pr-4">Cidade</th>
                    <th className="pb-2 pr-4">CEP</th>
                    <th className="pb-2 pr-4">E-mail</th>
                  </tr>
                </thead>
                <tbody>
                  {exportPreviewOrders.slice(0, 20).map(o => {
                    const p = o.profiles;
                    const addr = o.shipping_address || {};
                    return (
                      <tr key={o.id} className="border-t">
                        <td className="py-2 pr-4">{o.id}</td>
                        <td className="py-2 pr-4">{`${addr.street || ""}${addr.number ? `, ${addr.number}` : ""}`}</td>
                        <td className="py-2 pr-4">{p?.phone || <span className="text-red-400 italic">sem tel.</span>}</td>
                        <td className="py-2 pr-4">{addr.city || ""}</td>
                        <td className="py-2 pr-4">{addr.cep || ""}</td>
                        <td className="py-2 pr-4">
                          {o.email
                            ? o.email
                            : <span className="text-red-400 italic">sem e-mail</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {exportPreviewOrders.length > 20 && (
                <div className="text-sm text-muted-foreground pt-2 text-center">
                  ... e mais {exportPreviewOrders.length - 20} pedidos
                </div>
              )}
            </div>

            {exportPreviewOrders.some(o => !o.email) && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-3">
                <p className="text-sm text-amber-800">
                  ⚠️ {exportPreviewOrders.filter(o => !o.email).length} pedido(s) sem e-mail — a coluna ficará em branco na planilha.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsExportConfirmOpen(false)}>Cancelar</Button>
              <Button onClick={() => performExport(exportPreviewOrders, false)} disabled={isExporting}>
                {isExporting ? "Exportando..." : "Só Exportar"}
              </Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => performExport(exportPreviewOrders, true)} disabled={isExporting}>
                {isExporting ? "Exportando..." : "Exportar e Remover"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
