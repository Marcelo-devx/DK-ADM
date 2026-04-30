"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileDown, Map as MapIcon, Loader2, RefreshCw, Truck, CalendarClock } from "lucide-react";
import * as XLSX from "xlsx";
import { showSuccess, showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Order {
  id: number;
  created_at: string;
  total_price: number;
  status: string;
  delivery_status: string;
  delivery_info: string | null;
  shipping_address: any;
  user_id: string;
  email?: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
}

const checkIsNextRoute = (dateString: string) => {
  const orderDate = new Date(dateString);
  const day = orderDate.getDay();
  const cutoff = new Date(orderDate);
  cutoff.setSeconds(0);
  cutoff.setMilliseconds(0);
  if (day === 0) return true;
  else if (day === 6) cutoff.setHours(12, 30, 0);
  else cutoff.setHours(14, 0, 0);
  return orderDate > cutoff;
};

const fetchOrdersToExport = async (): Promise<Order[]> => {
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, created_at, total_price, status, delivery_status, delivery_info, user_id, shipping_address")
    .in("status", ["Finalizada", "Pago"])
    .in("delivery_status", ["Aguardando Coleta", "Embalado"])
    .order("created_at", { ascending: false });

  if (ordersError) throw new Error(ordersError.message);
  if (!orders) return [];

  const userIds = [...new Set(orders.map((o) => o.user_id).filter((id) => id !== null))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, phone, email")
    .in("id", userIds as string[]);

  if (profilesError) throw new Error(profilesError.message);
  const profilesMap = new Map(profiles.map((p) => [p.id, p]));

  return orders.map((order) => ({
    ...order,
    email: order.user_id ? (profilesMap.get(order.user_id) as any)?.email || "" : "",
    profiles: order.user_id ? profilesMap.get(order.user_id) || null : null,
  })) as Order[];
};

const getStatusColor = (status: string): string => {
  const s = status.toLowerCase();
  if (s.includes("aguardando coleta")) return "bg-green-100 text-green-800 border-green-300";
  if (s.includes("aguardando entregador")) return "bg-blue-100 text-blue-800 border-blue-300";
  if (s.includes("pendente")) return "bg-gray-100 text-gray-800 border-gray-300";
  if (s.includes("embalado")) return "bg-orange-100 text-orange-800 border-orange-300";
  if (s.includes("despachado")) return "bg-purple-100 text-purple-800 border-purple-300";
  if (s.includes("entregue")) return "bg-green-100 text-green-800 border-green-300";
  return "bg-gray-100 text-gray-800 border-gray-300";
};

const SpokeExportPage = () => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [changeStatus, setChangeStatus] = useState(false);
  const [clearSelection, setClearSelection] = useState(true);
  const [isTestExport, setIsTestExport] = useState(false);

  const { data: orders, isLoading, refetch, isRefetching } = useQuery<Order[]>({
    queryKey: ["ordersToExport"],
    queryFn: fetchOrdersToExport,
  });

  const canSelect = (o: Order) =>
    o.delivery_status === "Aguardando Coleta" || o.delivery_status === "Embalado";

  const selectableOrders = useMemo(() => orders?.filter(canSelect) ?? [], [orders]);

  const toggleSelectAll = () => {
    if (selectedIds.size === selectableOrders.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableOrders.map((o) => o.id)));
  };

  const toggleSelectOne = (id: number) => {
    const order = orders?.find((o) => o.id === id);
    if (!order || !canSelect(order)) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const cleanDigits = (val: string | null | undefined) => (val ? val.replace(/\D/g, "") : "");

  // Mensagens automáticas do sistema que NÃO são observações do admin
  const SYSTEM_MESSAGES = [
    "motorista designado para a entrega",
    "motorista iniciou o trajeto",
    "pedido entregue com sucesso",
    "motorista tentou entregar",
    "atualizado automaticamente",
    "despachado manualmente",
  ];
  const getAdminObs = (val: string | null | undefined): string => {
    if (!val) return "";
    const lower = val.toLowerCase();
    if (SYSTEM_MESSAGES.some((msg) => lower.includes(msg))) return "";
    return val;
  };

  const handleExport = async (testMode = false) => {
    if (selectedIds.size === 0) { showError("Selecione pelo menos um pedido para exportar."); return; }
    setIsExporting(true);
    try {
      const selectedOrders = orders?.filter((o) => selectedIds.has(o.id)) || [];
      const exportData = selectedOrders.map((order) => {
        const address = order.shipping_address || {};
        const profile = order.profiles;
        const phoneClean = cleanDigits(profile?.phone);
        const fullName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
        const observacao = getAdminObs(order.delivery_info);
        const notesValue = observacao && phoneClean
          ? `${observacao} wa.me/55${phoneClean}`
          : observacao || (phoneClean ? `wa.me/55${phoneClean}` : "");
        return {
          Id: order.id,
          "Recipient Name": fullName || "Cliente",
          "Address Line 1": `${address.street}, ${address.number}`,
          "Address Line 2": address.complement || "",
          Observação: observacao,
          "Recipient Phone Number": phoneClean,
          Notes: notesValue,
          Bairro: address.neighborhood || "",
          City: address.city || "",
          Zip: cleanDigits(address.cep),
          "  ": "",
          "Recipient Email Address": order.email || "",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Rota Spoke");
      const testSuffix = testMode ? "_TESTE" : "";
      XLSX.writeFile(workbook, `Rota_Spoke${testSuffix}_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`);
      showSuccess(`${selectedOrders.length} pedidos exportados!${testMode ? " (modo teste)" : ""}`);

      if (!testMode) {
        if (changeStatus) {
          const { error } = await supabase
            .from("orders")
            .update({ delivery_status: "Aguardando Entregador" })
            .in("id", selectedOrders.map((o) => o.id));
          if (error) showError("Exportado, mas falha ao atualizar status.");
          else { showSuccess('Status → "Aguardando Entregador".'); refetch(); }
        }
        if (clearSelection) setSelectedIds(new Set());
      }
    } catch (err) {
      console.error(err);
      showError("Erro ao gerar a planilha.");
    } finally {
      setIsExporting(false);
      setConfirmOpen(false);
      setIsTestExport(false);
    }
  };

  return (
    <div className="space-y-4 pb-32 md:pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-3xl font-bold flex items-center gap-2">
            <MapIcon className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
            Exportar Rotas
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm hidden md:block">
            Gere planilhas de rota compatíveis com o Spoke/Circuit.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCw className={cn("h-4 w-4 mr-1", isRefetching && "animate-spin")} />
          <span className="hidden md:inline">Atualizar</span>
        </Button>
      </div>

      {/* Desktop: sidebar layout */}
      <div className="hidden md:grid md:grid-cols-3 gap-6">
        {/* Tabela desktop */}
        <div className="md:col-span-2">
          <Card className="border-none shadow-md">
            <CardHeader className="bg-gray-50/50 border-b py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Truck className="h-4 w-4" /> Todos os Pedidos
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
                          checked={selectableOrders.length > 0 && selectedIds.size === selectableOrders.length}
                          onCheckedChange={toggleSelectAll}
                          disabled={selectableOrders.length === 0}
                        />
                      </TableHead>
                      <TableHead>Pedido & Data</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Bairro/Cidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={6} className="h-24 text-center">Carregando...</TableCell></TableRow>
                    ) : orders && orders.length > 0 ? orders.map((order) => {
                      const isNextRoute = checkIsNextRoute(order.created_at);
                      const isSelected = selectedIds.has(order.id);
                      const selectable = canSelect(order);
                      return (
                        <TableRow
                          key={order.id}
                          className={cn(
                            "cursor-pointer hover:bg-blue-50/50",
                            isSelected && "bg-blue-50",
                            isNextRoute && "bg-yellow-50/60 border-l-4 border-l-yellow-400"
                          )}
                          onClick={() => toggleSelectOne(order.id)}
                        >
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleSelectOne(order.id)}
                                  disabled={!selectable}
                                  className={cn(selectable ? "data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500" : "opacity-50 cursor-not-allowed")}
                                />
                              </TooltipTrigger>
                              {!selectable && <TooltipContent><p>Apenas "Aguardando Coleta" ou "Embalado"</p></TooltipContent>}
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-mono font-bold text-sm">#{order.id}</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleString("pt-BR")}</span>
                              {isNextRoute && (
                                <Badge variant="outline" className="mt-1 w-fit text-[9px] bg-yellow-100 text-yellow-800 border-yellow-300 gap-1 px-1">
                                  <CalendarClock className="w-3 h-3" /> Próx. Dia
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">
                                {order.profiles?.first_name || order.profiles?.last_name
                                  ? `${order.profiles?.first_name || ""} ${order.profiles?.last_name || ""}`.trim()
                                  : "Não informado"}
                              </span>
                              <span className="text-xs text-muted-foreground">{order.profiles?.phone || "-"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm">{order.shipping_address?.neighborhood}</span>
                              <span className="text-xs text-muted-foreground">{order.shipping_address?.city}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-[10px] font-medium border", getStatusColor(order.delivery_status))}>
                              {order.delivery_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-xs">
                            R$ {order.total_price.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Nenhum pedido encontrado.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Painel lateral desktop */}
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
                onClick={() => { setIsTestExport(false); setConfirmOpen(true); }}
                disabled={selectedIds.size === 0 || isExporting}
              >
                {isExporting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</> : <><FileDown className="mr-2 h-5 w-5" /> Baixar Planilha</>}
              </Button>
              <Button
                variant="outline"
                className="w-full border-dashed border-gray-400 text-gray-600 hover:bg-gray-50"
                onClick={() => { setIsTestExport(true); setConfirmOpen(true); }}
                disabled={selectedIds.size === 0 || isExporting}
              >
                <FileDown className="mr-2 h-4 w-4" /> Exportar Teste (sem alterar)
              </Button>
              <p className="text-[10px] text-center text-muted-foreground px-4">
                No Spoke: "Adicionar Paradas" → "Carregar arquivo".
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="md:hidden space-y-3">
        {/* Seleção rápida */}
        <div className="flex items-center justify-between bg-white border rounded-xl px-4 py-3 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer" onClick={toggleSelectAll}>
            <Checkbox
              checked={selectableOrders.length > 0 && selectedIds.size === selectableOrders.length}
              onCheckedChange={toggleSelectAll}
              disabled={selectableOrders.length === 0}
            />
            Selecionar todos ({selectableOrders.length})
          </label>
          <Badge variant="secondary">{orders?.length || 0} pedidos</Badge>
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Carregando...
          </div>
        ) : orders && orders.length > 0 ? orders.map((order) => {
          const isNextRoute = checkIsNextRoute(order.created_at);
          const isSelected = selectedIds.has(order.id);
          const selectable = canSelect(order);
          const addr = order.shipping_address || {};
          const name = order.profiles
            ? `${order.profiles.first_name || ""} ${order.profiles.last_name || ""}`.trim()
            : "Não informado";

          return (
            <div
              key={order.id}
              onClick={() => toggleSelectOne(order.id)}
              className={cn(
                "bg-white border rounded-xl p-4 shadow-sm flex gap-3 transition-all",
                isSelected && "border-blue-400 bg-blue-50 shadow-blue-100",
                isNextRoute && "border-l-4 border-l-yellow-400",
                !selectable && "opacity-60"
              )}
            >
              {/* Checkbox */}
              <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleSelectOne(order.id)}
                  disabled={!selectable}
                  className={cn(selectable ? "data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" : "opacity-40")}
                />
              </div>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-black text-base">#{order.id}</span>
                  <Badge className={cn("text-[10px] border shrink-0", getStatusColor(order.delivery_status))}>
                    {order.delivery_status}
                  </Badge>
                </div>

                <p className="font-semibold text-sm truncate">{name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {addr.street}{addr.number ? `, ${addr.number}` : ""} — {addr.neighborhood}, {addr.city}
                </p>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{order.profiles?.phone || "sem tel."}</span>
                  <span>•</span>
                  <span className="font-bold text-gray-700">R$ {order.total_price.toFixed(2)}</span>
                  {isNextRoute && (
                    <Badge variant="outline" className="text-[9px] bg-yellow-100 text-yellow-800 border-yellow-300 gap-1 px-1 ml-auto">
                      <CalendarClock className="w-3 h-3" /> Próx. Dia
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="text-center py-10 text-muted-foreground text-sm">Nenhum pedido encontrado.</div>
        )}
      </div>

      {/* ── Sticky action bar mobile ── */}
      {selectedIds.size > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-2xl px-4 py-3 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 h-12 border-dashed text-gray-600"
            onClick={() => { setIsTestExport(true); setConfirmOpen(true); }}
            disabled={isExporting}
          >
            <FileDown className="h-4 w-4 mr-1" /> Teste
          </Button>
          <Button
            className="flex-[2] h-12 font-bold bg-blue-600 hover:bg-blue-700 text-base"
            onClick={() => { setIsTestExport(false); setConfirmOpen(true); }}
            disabled={isExporting}
          >
            {isExporting
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando...</>
              : <><FileDown className="h-4 w-4 mr-2" /> Exportar {selectedIds.size} pedido{selectedIds.size > 1 ? "s" : ""}</>
            }
          </Button>
        </div>
      )}

      {/* Dialog de confirmação */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{isTestExport ? "Exportar Teste" : "Confirmar Exportação"}</DialogTitle>
            <DialogDescription>
              {isTestExport
                ? `${selectedIds.size} pedidos serão exportados para teste. Nenhum status será alterado.`
                : `${selectedIds.size} pedidos serão exportados para a planilha de rota.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {isTestExport ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                ⚠️ Modo teste: planilha gerada normalmente, mas <strong>nenhum status será alterado</strong>.
              </div>
            ) : (
              <>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    id="change-status"
                    checked={changeStatus}
                    onCheckedChange={(v) => setChangeStatus(v as boolean)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium">Mudar status para "Aguardando Entregador"?</p>
                    <p className="text-xs text-muted-foreground">Pedidos não poderão ser selecionados novamente.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    id="clear-selection"
                    checked={clearSelection}
                    onCheckedChange={(v) => setClearSelection(v as boolean)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium">Limpar seleção após exportar?</p>
                    <p className="text-xs text-muted-foreground">Desmarca os pedidos da lista.</p>
                  </div>
                </label>
              </>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={() => handleExport(isTestExport)} disabled={isExporting}>
              {isExporting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exportando...</>
                : <><FileDown className="mr-2 h-4 w-4" /> {isTestExport ? "Baixar Teste" : "Confirmar"}</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SpokeExportPage;