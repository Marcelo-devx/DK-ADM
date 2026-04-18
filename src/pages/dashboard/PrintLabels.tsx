"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileSpreadsheet, FileDown, Download, Loader2, Trash2, RefreshCw, Search } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

const TEMPLATE_HEADERS = [
  "Número pedido", "Nome Entrega", "Endereço", "Complemento", "Entrega",
  "Observações", "Telefone", "Nota Circuit", "Bairro Entrega",
  "Cidade Entrega", "CEP Entrega", "CPF/CNPJ Comprador", "E-mail Comprador",
];

const REMOVED_STORAGE_KEY = "print_labels_removed_orders_v1";

export default function PrintLabelsPage() {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
  const [isExportConfirmOpen, setIsExportConfirmOpen] = useState(false);
  const [exportPreviewOrders, setExportPreviewOrders] = useState<Order[]>([]);
  const refetchRef = useRef<(() => Promise<any>) | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(REMOVED_STORAGE_KEY);
      if (raw) setRemovedIds(new Set(JSON.parse(raw) as number[]));
    } catch { /* ignore */ }
  }, []);

  const persistRemovedIds = (next: Set<number>) => {
    try { localStorage.setItem(REMOVED_STORAGE_KEY, JSON.stringify(Array.from(next))); } catch { /* ignore */ }
  };

  const { data: orders, isLoading, refetch } = useQuery<Order[]>({
    queryKey: ["ordersForExcelExport"],
    queryFn: async () => {
      const { data: ordersData, error } = await supabase
        .from("orders")
        .select("id, created_at, total_price, status, delivery_status, shipping_address, user_id, delivery_info")
        .in("status", ["Finalizada", "Pago"])
        .in("delivery_status", ["Aguardando Coleta", "Pendente", "Embalado", "Despachado"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!ordersData || ordersData.length === 0) return [];

      const userIds = Array.from(new Set(ordersData.map((o: any) => o.user_id).filter(Boolean)));
      let profilesMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, phone, cpf_cnpj")
          .in("id", userIds);
        if (profilesData) profilesData.forEach((p: any) => profilesMap.set(String(p.id), p));
      }

      let emailMap = new Map<string, string>();
      try {
        const { data: emailsData } = await supabase.rpc("get_users_emails_by_ids", { user_ids: userIds });
        if (Array.isArray(emailsData)) emailsData.forEach((u: any) => { if (u.id && u.email) emailMap.set(u.id, u.email); });
      } catch { /* ignore */ }

      return ordersData.map((o: any) => ({
        ...o,
        profiles: o.user_id ? profilesMap.get(String(o.user_id)) ?? null : null,
        email: o.user_id ? (emailMap.get(o.user_id) || "") : "",
      }));
    },
    staleTime: 0,
  });

  refetchRef.current = refetch;

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    const term = searchTerm.trim().toLowerCase();
    const base = orders.filter((o) => !removedIds.has(o.id));
    if (!term) return base;
    return base.filter((o) => {
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
    if (selectedIds.size === filteredOrders.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
  };

  const toggleSelectOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleClearSelected = () => {
    if (selectedIds.size === 0) { showError("Selecione pelo menos um pedido."); return; }
    const count = selectedIds.size;
    const next = new Set(removedIds);
    selectedIds.forEach((id) => next.add(id));
    setRemovedIds(next);
    persistRemovedIds(next);
    setSelectedIds(new Set());
    showSuccess(`${count} pedido(s) removido(s) da lista.`);
  };

  const handleRefresh = async () => {
    try {
      if (refetchRef.current) { await refetchRef.current(); showSuccess("Pedidos atualizados."); }
    } catch { showError("Erro ao atualizar pedidos."); }
  };

  const cleanStr = (val: string | null | undefined) => val || "";

  const buildRowValues = (order: Order) => {
    const p = order.profiles;
    const addr = order.shipping_address || {};
    const fullName = `${cleanStr(p?.first_name)} ${cleanStr(p?.last_name)}`.trim();
    return {
      "Número pedido": order.id,
      "Nome Entrega": fullName,
      "Endereço": `${addr.street || ""}${addr.number ? `, ${addr.number}` : ""}`.trim(),
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
  };

  const handleExport = () => {
    if (selectedIds.size === 0) { showError("Selecione pelo menos um pedido."); return; }
    const selectedOrders = (orders ?? []).filter((o) => selectedIds.has(o.id) && !removedIds.has(o.id));
    if (selectedOrders.length === 0) { showError("Nenhum pedido disponível para exportação."); return; }
    setExportPreviewOrders(selectedOrders);
    setIsExportConfirmOpen(true);
  };

  const performExport = async (selectedOrders: Order[], removeAfterExport: boolean) => {
    setIsExporting(true);
    try {
      const exportData = selectedOrders.map(buildRowValues);
      const worksheet = XLSX.utils.json_to_sheet(exportData, { header: TEMPLATE_HEADERS });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Envios");
      XLSX.writeFile(workbook, `Envios_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`);

      if (removeAfterExport) {
        const next = new Set(removedIds);
        selectedOrders.forEach((o) => next.add(o.id));
        setRemovedIds(next);
        persistRemovedIds(next);
        const nextSelected = new Set(selectedIds);
        selectedOrders.forEach((o) => nextSelected.delete(o.id));
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
    const sample = [{
      "Número pedido": "12345", "Nome Entrega": "João Silva",
      "Endereço": "Rua das Flores, 123", "Complemento": "Apto 101",
      "Entrega": "", "Observações": "Frágil", "Telefone": "11999999999",
      "Nota Circuit": "", "Bairro Entrega": "Centro", "Cidade Entrega": "São Paulo",
      "CEP Entrega": "01000-000", "CPF/CNPJ Comprador": "123.456.789-00",
      "E-mail Comprador": "joao@email.com",
    }];
    const worksheet = XLSX.utils.json_to_sheet(sample, { header: TEMPLATE_HEADERS });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo");
    XLSX.writeFile(workbook, "modelo_envios.xlsx");
  };

  return (
    <div className="space-y-4 pb-32 md:pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-3xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 md:h-8 md:w-8 text-green-600" />
            Exportação de Etiquetas
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm hidden md:block">
            Gere planilhas para envio com dados completos de destinatário.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-1" />
          <span className="hidden md:inline">Atualizar</span>
        </Button>
      </div>

      {/* Barra de ações desktop */}
      <Card className="hidden md:block">
        <CardContent className="p-4 flex flex-wrap gap-2">
          <Button variant="outline" className="h-11" onClick={handleDownloadTemplate}>
            <FileDown className="w-4 h-4 mr-2 text-gray-500" /> Baixar Planilha de Exemplo
          </Button>
          <Button
            className={cn("h-11", selectedIds.size === 0 && "opacity-60")}
            onClick={handleExport}
            disabled={isExporting || selectedIds.size === 0}
          >
            {isExporting ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2" />}
            Exportar Selecionados ({selectedIds.size})
          </Button>
          {selectedIds.size > 0 && (
            <Button className="bg-red-600 hover:bg-red-700 text-white h-11" onClick={handleClearSelected}>
              <Trash2 className="w-4 h-4 mr-2" /> Limpar da lista ({selectedIds.size})
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Busca mobile */}
      <div className="md:hidden relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por ID, nome ou e-mail..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-11 rounded-xl"
        />
      </div>

      {/* ── DESKTOP: tabela ── */}
      <Card className="hidden md:block">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pedidos prontos para etiqueta</CardTitle>
          <Input
            placeholder="Buscar por ID, nome ou e-mail"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-72"
          />
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          {isLoading ? (
            <div className="p-6">
              <Skeleton className="h-8 w-full mb-2" />
              <Skeleton className="h-8 w-full mb-2" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="min-w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredOrders.length && filteredOrders.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </TableHead>
                    {TEMPLATE_HEADERS.map((h) => (
                      <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={TEMPLATE_HEADERS.length + 1} className="py-10 text-center text-muted-foreground">
                        Nenhum pedido encontrado.
                      </TableCell>
                    </TableRow>
                  ) : filteredOrders.map((order) => {
                    const rowValues = buildRowValues(order);
                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(order.id)}
                            onChange={() => toggleSelectOne(order.id)}
                          />
                        </TableCell>
                        {TEMPLATE_HEADERS.map((h) => (
                          <TableCell key={h} className="whitespace-nowrap">{String(rowValues[h as keyof typeof rowValues] ?? "")}</TableCell>
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

      {/* ── MOBILE: cards ── */}
      <div className="md:hidden space-y-3">
        {/* Selecionar todos */}
        <div className="flex items-center justify-between bg-white border rounded-xl px-4 py-3 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer" onClick={toggleSelectAll}>
            <input
              type="checkbox"
              checked={selectedIds.size === filteredOrders.length && filteredOrders.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 accent-green-600"
            />
            Selecionar todos ({filteredOrders.length})
          </label>
          <span className="text-xs text-muted-foreground">{selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}</span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Nenhum pedido encontrado.</div>
        ) : filteredOrders.map((order) => {
          const p = order.profiles;
          const addr = order.shipping_address || {};
          const fullName = `${cleanStr(p?.first_name)} ${cleanStr(p?.last_name)}`.trim() || "Sem nome";
          const isSelected = selectedIds.has(order.id);

          return (
            <div
              key={order.id}
              onClick={() => toggleSelectOne(order.id)}
              className={cn(
                "bg-white border-l-4 rounded-xl p-4 shadow-sm flex gap-3 transition-all cursor-pointer",
                isSelected ? "border-l-green-500 bg-green-50" : "border-l-gray-200"
              )}
            >
              {/* Checkbox */}
              <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelectOne(order.id)}
                  className="w-4 h-4 accent-green-600"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-black text-base">#{order.id}</span>
                  <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
                <p className="font-semibold text-sm truncate">{fullName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {addr.street}{addr.number ? `, ${addr.number}` : ""}
                  {addr.complement ? ` — ${addr.complement}` : ""}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {addr.neighborhood && <span>{addr.neighborhood}</span>}
                  {addr.city && <span>• {addr.city}</span>}
                  {addr.cep && <span>• CEP {addr.cep}</span>}
                </div>
                {p?.phone && <p className="text-xs text-gray-600">📞 {p.phone}</p>}
                {order.delivery_info && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-0.5 truncate">
                    📝 {order.delivery_info}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Sticky action bar mobile ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-2xl px-4 py-3 space-y-2">
        {selectedIds.size > 0 ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-12 border-red-200 text-red-600 hover:bg-red-50"
              onClick={handleClearSelected}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Remover ({selectedIds.size})
            </Button>
            <Button
              className="flex-[2] h-12 font-bold bg-green-600 hover:bg-green-700 text-base"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Exportando...</>
                : <><Download className="h-4 w-4 mr-2" /> Exportar {selectedIds.size}</>
              }
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="w-full h-11" onClick={handleDownloadTemplate}>
            <FileDown className="w-4 h-4 mr-2 text-gray-500" /> Baixar Planilha de Exemplo
          </Button>
        )}
      </div>

      {/* Dialog de confirmação de exportação */}
      <Dialog open={isExportConfirmOpen} onOpenChange={setIsExportConfirmOpen}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmar Exportação</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <p className="text-sm text-muted-foreground">
              Você está prestes a exportar <strong>{exportPreviewOrders.length}</strong> pedido(s). Escolha uma opção:
            </p>

            {/* Preview compacto */}
            <div className="max-h-48 overflow-auto border rounded-xl divide-y text-sm">
              {exportPreviewOrders.slice(0, 20).map((o) => {
                const p = o.profiles;
                const addr = o.shipping_address || {};
                return (
                  <div key={o.id} className="px-3 py-2 flex items-start gap-2">
                    <span className="font-mono font-bold text-xs shrink-0">#{o.id}</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-medium">
                        {`${cleanStr(p?.first_name)} ${cleanStr(p?.last_name)}`.trim() || "Sem nome"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {addr.street}{addr.number ? `, ${addr.number}` : ""} — {addr.city}
                      </p>
                    </div>
                    {!o.email && <span className="text-[10px] text-red-400 shrink-0">sem e-mail</span>}
                  </div>
                );
              })}
              {exportPreviewOrders.length > 20 && (
                <div className="text-xs text-muted-foreground text-center py-2">
                  ... e mais {exportPreviewOrders.length - 20} pedidos
                </div>
              )}
            </div>

            {exportPreviewOrders.some((o) => !o.email) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-sm text-amber-800">
                  ⚠️ {exportPreviewOrders.filter((o) => !o.email).length} pedido(s) sem e-mail — coluna ficará em branco.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setIsExportConfirmOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={() => performExport(exportPreviewOrders, false)} disabled={isExporting}>
                {isExporting ? "Exportando..." : "Só Exportar"}
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => performExport(exportPreviewOrders, true)}
                disabled={isExporting}
              >
                {isExporting ? "Exportando..." : "Exportar e Remover"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
