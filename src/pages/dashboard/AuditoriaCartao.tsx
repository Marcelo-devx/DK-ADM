import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, ShieldAlert, RefreshCw, FileDown, CheckCircle2,
  RotateCcw, TrendingDown, DollarSign, Percent, Search, Filter,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

const fmt = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const fmtDate = (iso: string) =>
  format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });

const fmtNum = (val: number, decimals = 2) =>
  val.toFixed(decimals).replace(".", ",");

// ─── Types ────────────────────────────────────────────────────────────────────

interface Order {
  id: number;
  created_at: string;
  total_price: number;
  payment_method: string | null;
  status: string;
  guest_email: string | null;
  user_id: string | null;
  shipping_address: Record<string, string> | null;
}

interface AuditRecord {
  id: number;
  order_id: number;
  taxa_percent: number;
  taxa_valor: number;
  valor_liquido: number;
  conferido_em: string;
  orders: Order | Order[] | null;
}

interface TaxaState {
  percent: string;
  valor: string;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

const fetchCardOrders = async (startDate: string, endDate: string) => {
  const { data, error } = await supabase
    .from("orders")
    .select("id, created_at, total_price, payment_method, status, guest_email, user_id, shipping_address")
    .in("status", ["Finalizada", "Pago"])
    .ilike("payment_method", "%cart%")
    .gte("created_at", startDate)
    .lte("created_at", endDate + "T23:59:59")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Order[];
};

const fetchAudits = async () => {
  const { data, error } = await supabase
    .from("credit_card_audits")
    .select("id, order_id, taxa_percent, taxa_valor, valor_liquido, conferido_em, orders(id, created_at, total_price, payment_method, status, guest_email, user_id, shipping_address)")
    .order("conferido_em", { ascending: false });
  if (error) throw error;
  return (data || []) as AuditRecord[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getClientName = (order: Order): string => {
  if (order.shipping_address) {
    const fn = order.shipping_address.first_name || "";
    const ln = order.shipping_address.last_name || "";
    const name = `${fn} ${ln}`.trim();
    if (name) return name;
  }
  return order.guest_email || order.user_id?.slice(0, 8) || "—";
};

// ─── Main Component ───────────────────────────────────────────────────────────

const AuditoriaCartao = () => {
  const queryClient = useQueryClient();

  // Filtros
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [searchTerm, setSearchTerm] = useState("");
  const [minVal, setMinVal] = useState("");
  const [maxVal, setMaxVal] = useState("");

  // Taxa padrão global
  const [globalPercent, setGlobalPercent] = useState("");
  const [globalValor, setGlobalValor] = useState("");

  // Taxas individuais por pedido: { [orderId]: { percent, valor } }
  const [taxas, setTaxas] = useState<Record<number, TaxaState>>({});

  // Seleção
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: allOrders = [], isLoading: loadingOrders, refetch, isFetching } = useQuery({
    queryKey: ["auditoria-cartao-orders", startDate, endDate],
    queryFn: () => fetchCardOrders(startDate, endDate),
    staleTime: 0,
  });

  const { data: audits = [], isLoading: loadingAudits } = useQuery({
    queryKey: ["credit-card-audits"],
    queryFn: fetchAudits,
    staleTime: 0,
  });

  // IDs já conferidos
  const auditedIds = useMemo(() => new Set(audits.map((a) => a.order_id)), [audits]);

  // Pedidos ainda não conferidos
  const pendingOrders = useMemo(
    () => allOrders.filter((o) => !auditedIds.has(o.id)),
    [allOrders, auditedIds]
  );

  // Filtros aplicados sobre pendingOrders
  const filteredOrders = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const min = minVal ? parseFloat(minVal.replace(",", ".")) : null;
    const max = maxVal ? parseFloat(maxVal.replace(",", ".")) : null;
    return pendingOrders.filter((o) => {
      if (term) {
        const idMatch = String(o.id).includes(term);
        const emailMatch = (o.guest_email || "").toLowerCase().includes(term);
        const nameMatch = getClientName(o).toLowerCase().includes(term);
        if (!idMatch && !emailMatch && !nameMatch) return false;
      }
      const price = Number(o.total_price);
      if (min !== null && price < min) return false;
      if (max !== null && price > max) return false;
      return true;
    });
  }, [pendingOrders, searchTerm, minVal, maxVal]);

  // ── Taxa helpers ──────────────────────────────────────────────────────────────

  const getTaxa = useCallback(
    (orderId: number): TaxaState => taxas[orderId] || { percent: "", valor: "" },
    [taxas]
  );

  const setTaxaPercent = useCallback((orderId: number, val: string, totalPrice: number) => {
    const pct = parseFloat(val.replace(",", "."));
    const valorCalc = !isNaN(pct) ? ((pct / 100) * totalPrice).toFixed(2) : "";
    setTaxas((prev) => ({
      ...prev,
      [orderId]: { percent: val, valor: valorCalc },
    }));
  }, []);

  const setTaxaValor = useCallback((orderId: number, val: string, totalPrice: number) => {
    const v = parseFloat(val.replace(",", "."));
    const pctCalc = !isNaN(v) && totalPrice > 0 ? ((v / totalPrice) * 100).toFixed(4) : "";
    setTaxas((prev) => ({
      ...prev,
      [orderId]: { percent: pctCalc, valor: val },
    }));
  }, []);

  const applyGlobalTaxa = () => {
    if (!globalPercent && !globalValor) return;
    const newTaxas: Record<number, TaxaState> = { ...taxas };
    filteredOrders.forEach((o) => {
      const price = Number(o.total_price);
      if (globalPercent) {
        const pct = parseFloat(globalPercent.replace(",", "."));
        const valorCalc = !isNaN(pct) ? ((pct / 100) * price).toFixed(2) : "";
        newTaxas[o.id] = { percent: globalPercent, valor: valorCalc };
      } else if (globalValor) {
        const v = parseFloat(globalValor.replace(",", "."));
        const pctCalc = !isNaN(v) && price > 0 ? ((v / price) * 100).toFixed(4) : "";
        newTaxas[o.id] = { percent: pctCalc, valor: globalValor };
      }
    });
    setTaxas(newTaxas);
    toast({ title: "Taxa aplicada a todos os pedidos filtrados!" });
  };

  const handleGlobalPercentChange = (val: string) => {
    setGlobalPercent(val);
    const pct = parseFloat(val.replace(",", "."));
    if (!isNaN(pct) && filteredOrders.length > 0) {
      const avgPrice = filteredOrders.reduce((a, o) => a + Number(o.total_price), 0) / filteredOrders.length;
      setGlobalValor(((pct / 100) * avgPrice).toFixed(2));
    } else {
      setGlobalValor("");
    }
  };

  const handleGlobalValorChange = (val: string) => {
    setGlobalValor(val);
    setGlobalPercent("");
  };

  // ── Resumo em tempo real ──────────────────────────────────────────────────────

  const summary = useMemo(() => {
    let totalBruto = 0, totalTaxas = 0;
    filteredOrders.forEach((o) => {
      const price = Number(o.total_price);
      totalBruto += price;
      const t = getTaxa(o.id);
      const tv = parseFloat(t.valor.replace(",", "."));
      if (!isNaN(tv)) totalTaxas += tv;
    });
    const taxaMedia = totalBruto > 0 ? (totalTaxas / totalBruto) * 100 : 0;
    return { totalBruto, totalTaxas, totalLiquido: totalBruto - totalTaxas, taxaMedia };
  }, [filteredOrders, getTaxa]);

  const getAuditOrder = (a: AuditRecord): Order | null => {
    if (!a.orders) return null;
    return Array.isArray(a.orders) ? (a.orders[0] ?? null) : a.orders;
  };

  const auditSummary = useMemo(() => {
    let totalBruto = 0, totalTaxas = 0;
    audits.forEach((a) => {
      const o = getAuditOrder(a);
      totalBruto += Number(o?.total_price || 0);
      totalTaxas += Number(a.taxa_valor);
    });
    return { totalBruto, totalTaxas, totalLiquido: totalBruto - totalTaxas };
  }, [audits]);

  // ── Seleção ───────────────────────────────────────────────────────────────────

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredOrders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const moveToConferidos = useMutation({
    mutationFn: async (orderIds: number[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      const rows = orderIds.map((id) => {
        const order = filteredOrders.find((o) => o.id === id)!;
        const price = Number(order.total_price);
        const t = getTaxa(id);
        const tv = parseFloat(t.valor.replace(",", ".")) || 0;
        const tp = parseFloat(t.percent.replace(",", ".")) || 0;
        return {
          order_id: id,
          taxa_percent: tp,
          taxa_valor: tv,
          valor_liquido: price - tv,
          conferido_por: user?.id || null,
        };
      });
      const { error } = await supabase.from("credit_card_audits").upsert(rows, { onConflict: "order_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-card-audits"] });
      queryClient.invalidateQueries({ queryKey: ["auditoria-cartao-orders"] });
      setSelected(new Set());
      toast({ title: `${selected.size} pedido(s) movido(s) para Conferidos!` });
    },
    onError: (e: Error) => toast({ title: "Erro ao mover pedidos", description: e.message, variant: "destructive" }),
  });

  const devolver = useMutation({
    mutationFn: async (orderId: number) => {
      const { error } = await supabase.from("credit_card_audits").delete().eq("order_id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-card-audits"] });
      queryClient.invalidateQueries({ queryKey: ["auditoria-cartao-orders"] });
      toast({ title: "Pedido devolvido para A Conferir!" });
    },
    onError: (e: Error) => toast({ title: "Erro ao devolver pedido", description: e.message, variant: "destructive" }),
  });

  // ── CSV Export ────────────────────────────────────────────────────────────────

  const exportPendingCSV = () => {
    const header = ["ID", "Data", "Cliente", "Valor Bruto (R$)", "Taxa (%)", "Taxa (R$)", "Líquido (R$)"].join(";");
    const rows = filteredOrders.map((o) => {
      const t = getTaxa(o.id);
      const tv = parseFloat(t.valor.replace(",", ".")) || 0;
      const tp = parseFloat(t.percent.replace(",", ".")) || 0;
      const price = Number(o.total_price);
      return [
        o.id,
        fmtDate(o.created_at),
        getClientName(o),
        price.toFixed(2).replace(".", ","),
        tp.toFixed(4).replace(".", ","),
        tv.toFixed(2).replace(".", ","),
        (price - tv).toFixed(2).replace(".", ","),
      ].join(";");
    });
    downloadCSV([header, ...rows].join("\n"), `auditoria_cartao_pendente_${startDate}_${endDate}.csv`);
  };

  const exportAuditCSV = () => {
    const header = ["ID Pedido", "Data Pedido", "Conferido Em", "Cliente", "Valor Bruto (R$)", "Taxa (%)", "Taxa (R$)", "Líquido (R$)"].join(";");
    const rows = audits.map((a) => {
      const o = getAuditOrder(a);
      return [
        a.order_id,
        o ? fmtDate(o.created_at) : "",
        fmtDate(a.conferido_em),
        o ? getClientName(o) : "",
        o ? Number(o.total_price).toFixed(2).replace(".", ",") : "",
        Number(a.taxa_percent).toFixed(4).replace(".", ","),
        Number(a.taxa_valor).toFixed(2).replace(".", ","),
        Number(a.valor_liquido).toFixed(2).replace(".", ","),
      ].join(";");
    });
    downloadCSV([header, ...rows].join("\n"), `auditoria_cartao_conferidos.csv`);
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const isLoading = loadingOrders || loadingAudits;

  return (
    <div className="space-y-5 p-1">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="w-5 h-5 text-red-600" />
          <span className="text-xs font-bold uppercase tracking-widest text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
            Acesso Restrito
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-purple-600" />
          <h1 className="text-xl font-black tracking-tight">Auditoria Cartão de Crédito</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pedidos finalizados/pagos com cartão. Calcule a taxa da operadora e marque como conferido.
        </p>
      </div>

      {/* Filtros de período */}
      <div className="bg-white p-3 rounded-xl border shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
          <Filter className="w-3.5 h-3.5" /> Filtros
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">De</span>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 w-36 text-xs" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Até</span>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 w-36 text-xs" />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Busca (ID / cliente)</span>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ID, nome ou e-mail..."
                className="h-8 text-xs pl-7"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Valor mín (R$)</span>
            <Input value={minVal} onChange={(e) => setMinVal(e.target.value)} placeholder="0,00" className="h-8 w-28 text-xs" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Valor máx (R$)</span>
            <Input value={maxVal} onChange={(e) => setMaxVal(e.target.value)} placeholder="9999,00" className="h-8 w-28 text-xs" />
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="h-8">
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <Tabs defaultValue="a-conferir">
          <TabsList className="mb-4">
            <TabsTrigger value="a-conferir" className="gap-2">
              <CreditCard className="w-3.5 h-3.5" />
              A Conferir
              <Badge variant="secondary" className="ml-1 text-xs">{filteredOrders.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="conferidos" className="gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Conferidos
              <Badge variant="secondary" className="ml-1 text-xs bg-green-100 text-green-800">{audits.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* ── ABA: A CONFERIR ─────────────────────────────────────────────── */}
          <TabsContent value="a-conferir" className="space-y-4">

            {/* Taxa padrão global */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-purple-700 flex items-center gap-1">
                <Percent className="w-3.5 h-3.5" /> Taxa Padrão Global
              </p>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Porcentagem (%)</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={globalPercent}
                    onChange={(e) => handleGlobalPercentChange(e.target.value)}
                    placeholder="ex: 2,99"
                    className="h-8 w-32 text-xs"
                  />
                </div>
                <div className="flex items-end pb-1 text-xs text-muted-foreground font-bold">ou</div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Valor fixo (R$)</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={globalValor}
                    onChange={(e) => handleGlobalValorChange(e.target.value)}
                    placeholder="ex: 15,00"
                    className="h-8 w-32 text-xs"
                  />
                </div>
                <Button size="sm" onClick={applyGlobalTaxa} className="h-8 bg-purple-600 hover:bg-purple-700">
                  Aplicar a todos
                </Button>
              </div>
            </div>

            {/* Cards resumo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Total Bruto
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <p className="text-base font-black text-purple-700">{fmt(summary.totalBruto)}</p>
                  <p className="text-[11px] text-muted-foreground">{filteredOrders.length} pedidos</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-red-400">
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" /> Total Taxas
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <p className="text-base font-black text-red-600">{fmt(summary.totalTaxas)}</p>
                  <p className="text-[11px] text-muted-foreground">média {fmtNum(summary.taxaMedia, 2)}%</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Líquido
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <p className="text-base font-black text-green-700">{fmt(summary.totalLiquido)}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-blue-400">
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Percent className="w-3 h-3" /> Taxa Média
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <p className="text-base font-black text-blue-700">{fmtNum(summary.taxaMedia, 2)}%</p>
                </CardContent>
              </Card>
            </div>

            {/* Barra de ações */}
            <div className="flex flex-wrap gap-2 items-center justify-between bg-gray-50 border rounded-xl px-3 py-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={filteredOrders.length > 0 && selected.size === filteredOrders.length}
                  onCheckedChange={toggleAll}
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-xs font-medium cursor-pointer">
                  {selected.size > 0 ? `${selected.size} selecionado(s)` : "Selecionar todos"}
                </label>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={selected.size === 0 || moveToConferidos.isPending}
                  onClick={() => moveToConferidos.mutate(Array.from(selected))}
                  className="h-8 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Mover para Conferidos ({selected.size})
                </Button>
                <Button size="sm" variant="outline" onClick={exportPendingCSV} className="h-8">
                  <FileDown className="w-3.5 h-3.5 mr-1" /> CSV
                </Button>
              </div>
            </div>

            {/* Tabela desktop */}
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhum pedido de cartão encontrado para o período.
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden md:block border rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-gray-50">
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead className="text-xs w-20">ID</TableHead>
                          <TableHead className="text-xs">Data</TableHead>
                          <TableHead className="text-xs">Cliente</TableHead>
                          <TableHead className="text-xs text-right">Valor Bruto</TableHead>
                          <TableHead className="text-xs text-center w-32">Taxa (%)</TableHead>
                          <TableHead className="text-xs text-center w-32">Taxa (R$)</TableHead>
                          <TableHead className="text-xs text-right">Líquido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order) => {
                          const t = getTaxa(order.id);
                          const price = Number(order.total_price);
                          const tv = parseFloat(t.valor.replace(",", ".")) || 0;
                          const liquido = price - tv;
                          const isSelected = selected.has(order.id);
                          return (
                            <TableRow key={order.id} className={isSelected ? "bg-purple-50" : ""}>
                              <TableCell>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleSelect(order.id)}
                                />
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">#{order.id}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{fmtDate(order.created_at)}</TableCell>
                              <TableCell className="text-xs max-w-[140px] truncate">{getClientName(order)}</TableCell>
                              <TableCell className="text-right font-bold text-sm">{fmt(price)}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={t.percent}
                                  onChange={(e) => setTaxaPercent(order.id, e.target.value, price)}
                                  placeholder="0,00"
                                  className="h-7 text-xs text-center w-full"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={t.valor}
                                  onChange={(e) => setTaxaValor(order.id, e.target.value, price)}
                                  placeholder="0,00"
                                  className="h-7 text-xs text-center w-full"
                                />
                              </TableCell>
                              <TableCell className={`text-right font-bold text-sm ${tv > 0 ? "text-green-700" : "text-muted-foreground"}`}>
                                {fmt(liquido)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Mobile */}
                <div className="md:hidden space-y-2">
                  {filteredOrders.map((order) => {
                    const t = getTaxa(order.id);
                    const price = Number(order.total_price);
                    const tv = parseFloat(t.valor.replace(",", ".")) || 0;
                    const liquido = price - tv;
                    const isSelected = selected.has(order.id);
                    return (
                      <div key={order.id} className={`rounded-xl border p-3 space-y-2 ${isSelected ? "bg-purple-50 border-purple-300" : "bg-white"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(order.id)} />
                            <div>
                              <p className="font-mono text-xs text-muted-foreground">#{order.id}</p>
                              <p className="text-xs text-muted-foreground">{fmtDate(order.created_at)}</p>
                              <p className="text-xs font-medium">{getClientName(order)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm">{fmt(price)}</p>
                            {tv > 0 && <p className="text-xs text-green-700 font-semibold">Líq: {fmt(liquido)}</p>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <p className="text-[10px] text-muted-foreground mb-1">Taxa %</p>
                            <Input
                              type="number"
                              step="0.01"
                              value={t.percent}
                              onChange={(e) => setTaxaPercent(order.id, e.target.value, price)}
                              placeholder="0,00"
                              className="h-7 text-xs text-center"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] text-muted-foreground mb-1">Taxa R$</p>
                            <Input
                              type="number"
                              step="0.01"
                              value={t.valor}
                              onChange={(e) => setTaxaValor(order.id, e.target.value, price)}
                              placeholder="0,00"
                              className="h-7 text-xs text-center"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totais rodapé */}
                <div className="flex flex-wrap gap-3 justify-end text-sm pt-1">
                  <span className="text-muted-foreground">Bruto: <strong className="text-foreground">{fmt(summary.totalBruto)}</strong></span>
                  <span className="text-muted-foreground">Taxas: <strong className="text-red-600">{fmt(summary.totalTaxas)}</strong></span>
                  <span className="text-muted-foreground">Líquido: <strong className="text-green-700">{fmt(summary.totalLiquido)}</strong></span>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── ABA: CONFERIDOS ─────────────────────────────────────────────── */}
          <TabsContent value="conferidos" className="space-y-4">

            {/* Cards resumo conferidos */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs text-muted-foreground font-medium">Total Bruto</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <p className="text-base font-black text-green-700">{fmt(auditSummary.totalBruto)}</p>
                  <p className="text-[11px] text-muted-foreground">{audits.length} pedidos</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-red-400">
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs text-muted-foreground font-medium">Total Taxas</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <p className="text-base font-black text-red-600">{fmt(auditSummary.totalTaxas)}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-blue-500 col-span-2 md:col-span-1">
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs text-muted-foreground font-medium">Líquido Total</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <p className="text-base font-black text-blue-700">{fmt(auditSummary.totalLiquido)}</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={exportAuditCSV} className="h-8">
                <FileDown className="w-3.5 h-3.5 mr-1" /> Exportar CSV
              </Button>
            </div>

            {audits.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhum pedido conferido ainda. Selecione pedidos na aba "A Conferir" e mova para cá.
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden md:block border rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-green-50">
                        <TableRow>
                          <TableHead className="text-xs w-20">ID</TableHead>
                          <TableHead className="text-xs">Data Pedido</TableHead>
                          <TableHead className="text-xs">Conferido Em</TableHead>
                          <TableHead className="text-xs">Cliente</TableHead>
                          <TableHead className="text-xs text-right">Valor Bruto</TableHead>
                          <TableHead className="text-xs text-right">Taxa %</TableHead>
                          <TableHead className="text-xs text-right">Taxa R$</TableHead>
                          <TableHead className="text-xs text-right">Líquido</TableHead>
                          <TableHead className="text-xs text-center w-20">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {audits.map((audit) => {
                          const o = getAuditOrder(audit);
                          const price = o ? Number(o.total_price) : 0;
                          return (
                            <TableRow key={audit.id}>
                              <TableCell className="font-mono text-xs text-muted-foreground">#{audit.order_id}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{o ? fmtDate(o.created_at) : "—"}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap text-green-700">{fmtDate(audit.conferido_em)}</TableCell>
                              <TableCell className="text-xs max-w-[140px] truncate">{o ? getClientName(o) : "—"}</TableCell>
                              <TableCell className="text-right font-bold text-sm">{fmt(price)}</TableCell>
                              <TableCell className="text-right text-xs text-red-600">{fmtNum(Number(audit.taxa_percent), 2)}%</TableCell>
                              <TableCell className="text-right text-xs text-red-600">{fmt(Number(audit.taxa_valor))}</TableCell>
                              <TableCell className="text-right font-bold text-sm text-green-700">{fmt(Number(audit.valor_liquido))}</TableCell>
                              <TableCell className="text-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-orange-500 hover:text-orange-700 hover:bg-orange-50"
                                  onClick={() => devolver.mutate(audit.order_id)}
                                  disabled={devolver.isPending}
                                  title="Devolver para A Conferir"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Mobile */}
                <div className="md:hidden space-y-2">
                  {audits.map((audit) => {
                    const o = getAuditOrder(audit);
                    const price = o ? Number(o.total_price) : 0;
                    return (
                      <div key={audit.id} className="rounded-xl border bg-green-50/40 border-green-200 p-3 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs text-muted-foreground">#{audit.order_id}</p>
                            <p className="text-xs text-muted-foreground">{o ? fmtDate(o.created_at) : "—"}</p>
                            <p className="text-xs font-medium">{o ? getClientName(o) : "—"}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm">{fmt(price)}</p>
                            <p className="text-xs text-red-600">Taxa: {fmt(Number(audit.taxa_valor))} ({fmtNum(Number(audit.taxa_percent), 2)}%)</p>
                            <p className="text-xs text-green-700 font-semibold">Líq: {fmt(Number(audit.valor_liquido))}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-green-700">✓ {fmtDate(audit.conferido_em)}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-orange-500 hover:text-orange-700"
                            onClick={() => devolver.mutate(audit.order_id)}
                            disabled={devolver.isPending}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" /> Devolver
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totais rodapé */}
                <div className="flex flex-wrap gap-3 justify-end text-sm pt-1">
                  <span className="text-muted-foreground">Bruto: <strong className="text-foreground">{fmt(auditSummary.totalBruto)}</strong></span>
                  <span className="text-muted-foreground">Taxas: <strong className="text-red-600">{fmt(auditSummary.totalTaxas)}</strong></span>
                  <span className="text-muted-foreground">Líquido: <strong className="text-green-700">{fmt(auditSummary.totalLiquido)}</strong></span>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default AuditoriaCartao;