import { useState, useMemo, useCallback, useRef } from "react";
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
  RotateCcw, TrendingDown, DollarSign, Percent, Search, Filter, Save,
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
  status: string;
  orders: Order | Order[] | null;
}

interface TaxaState {
  percent: string;
  valor: string;
  liquido: string;
  saving?: boolean;
  saved?: boolean;
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
    .select("id, order_id, taxa_percent, taxa_valor, valor_liquido, conferido_em, status, orders(id, created_at, total_price, payment_method, status, guest_email, user_id, shipping_address)")
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

  // Taxas individuais por pedido: { [orderId]: TaxaState }
  const [taxas, setTaxas] = useState<Record<number, TaxaState>>({});

  // Seleção
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Debounce timers para auto-save
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

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
    // Ao carregar audits, inicializa taxas locais com os valores do banco (status pendente)
    select: (data) => {
      return data;
    },
  });

  // Inicializa taxas locais a partir dos registros pendentes do banco
  const pendingAudits = useMemo(() => audits.filter((a) => a.status === "pendente"), [audits]);
  const conferidoAudits = useMemo(() => audits.filter((a) => a.status === "conferido"), [audits]);

  // IDs que já têm registro no banco (pendente ou conferido)
  const auditedIds = useMemo(() => new Set(conferidoAudits.map((a) => a.order_id)), [conferidoAudits]);
  const pendingAuditMap = useMemo(() => {
    const map: Record<number, AuditRecord> = {};
    pendingAudits.forEach((a) => { map[a.order_id] = a; });
    return map;
  }, [pendingAudits]);

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
    (orderId: number): TaxaState => {
      // Prioridade: estado local > banco (pendente)
      if (taxas[orderId] !== undefined) return taxas[orderId];
      const fromDb = pendingAuditMap[orderId];
      if (fromDb) {
        const tv = Number(fromDb.taxa_valor);
        const tp = Number(fromDb.taxa_percent);
        const liq = Number(fromDb.valor_liquido);
        return {
          percent: tp > 0 ? String(tp) : "",
          valor: tv > 0 ? String(tv) : "",
          liquido: liq > 0 ? String(liq) : "",
        };
      }
      return { percent: "", valor: "", liquido: "" };
    },
    [taxas, pendingAuditMap]
  );

  const setTaxaPercent = useCallback((orderId: number, val: string, totalPrice: number) => {
    const pct = parseFloat(val.replace(",", "."));
    const tv = !isNaN(pct) ? (pct / 100) * totalPrice : NaN;
    const valorCalc = !isNaN(tv) ? tv.toFixed(2) : "";
    const liquidoCalc = !isNaN(tv) ? (totalPrice - tv).toFixed(2) : "";
    setTaxas((prev) => ({
      ...prev,
      [orderId]: { percent: val, valor: valorCalc, liquido: liquidoCalc, saved: false },
    }));
  }, []);

  const setTaxaValor = useCallback((orderId: number, val: string, totalPrice: number) => {
    const v = parseFloat(val.replace(",", "."));
    const pctCalc = !isNaN(v) && totalPrice > 0 ? ((v / totalPrice) * 100).toFixed(4) : "";
    const liquidoCalc = !isNaN(v) ? (totalPrice - v).toFixed(2) : "";
    setTaxas((prev) => ({
      ...prev,
      [orderId]: { percent: pctCalc, valor: val, liquido: liquidoCalc, saved: false },
    }));
  }, []);

  const setTaxaLiquido = useCallback((orderId: number, val: string, totalPrice: number) => {
    const liq = parseFloat(val.replace(",", "."));
    const tv = !isNaN(liq) ? totalPrice - liq : NaN;
    const valorCalc = !isNaN(tv) && tv >= 0 ? tv.toFixed(2) : "";
    const pctCalc = !isNaN(tv) && tv >= 0 && totalPrice > 0 ? ((tv / totalPrice) * 100).toFixed(4) : "";
    setTaxas((prev) => ({
      ...prev,
      [orderId]: { percent: pctCalc, valor: valorCalc, liquido: val, saved: false },
    }));
  }, []);

  // ── Auto-save ao sair do campo (onBlur) ───────────────────────────────────────

  const saveTaxaMutation = useMutation({
    mutationFn: async ({ orderId, totalPrice }: { orderId: number; totalPrice: number }) => {
      const t = taxas[orderId] || { percent: "", valor: "", liquido: "" };
      const tv = parseFloat(t.valor.replace(",", ".")) || 0;
      const tp = parseFloat(t.percent.replace(",", ".")) || 0;
      const liq = parseFloat(t.liquido.replace(",", "."));
      const valorLiquido = !isNaN(liq) ? liq : totalPrice - tv;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("credit_card_audits").upsert(
        {
          order_id: orderId,
          taxa_percent: tp,
          taxa_valor: tv,
          valor_liquido: valorLiquido,
          status: "pendente",
          conferido_por: user?.id || null,
        },
        { onConflict: "order_id" }
      );
      if (error) throw error;
      return orderId;
    },
    onSuccess: (orderId) => {
      setTaxas((prev) => ({
        ...prev,
        [orderId]: { ...prev[orderId], saved: true, saving: false },
      }));
      queryClient.invalidateQueries({ queryKey: ["credit-card-audits"] });
    },
    onError: (e: Error, { orderId }) => {
      setTaxas((prev) => ({
        ...prev,
        [orderId]: { ...prev[orderId], saving: false },
      }));
      toast({ title: "Erro ao salvar taxa", description: e.message, variant: "destructive" });
    },
  });

  const handleTaxaBlur = useCallback((orderId: number, totalPrice: number) => {
    // Debounce: aguarda 600ms após o último blur para salvar
    if (saveTimers.current[orderId]) clearTimeout(saveTimers.current[orderId]);
    saveTimers.current[orderId] = setTimeout(() => {
      setTaxas((prev) => ({
        ...prev,
        [orderId]: { ...prev[orderId], saving: true },
      }));
      saveTaxaMutation.mutate({ orderId, totalPrice });
    }, 600);
  }, [saveTaxaMutation, taxas]);

  const applyGlobalTaxa = () => {
    if (!globalPercent && !globalValor) return;
    const newTaxas: Record<number, TaxaState> = { ...taxas };
    filteredOrders.forEach((o) => {
      const price = Number(o.total_price);
      if (globalPercent) {
        const pct = parseFloat(globalPercent.replace(",", "."));
        const tv = !isNaN(pct) ? (pct / 100) * price : 0;
        newTaxas[o.id] = { percent: globalPercent, valor: tv.toFixed(2), liquido: (price - tv).toFixed(2), saved: false };
      } else if (globalValor) {
        const v = parseFloat(globalValor.replace(",", "."));
        const pctCalc = !isNaN(v) && price > 0 ? ((v / price) * 100).toFixed(4) : "";
        newTaxas[o.id] = { percent: pctCalc, valor: globalValor, liquido: (price - (v || 0)).toFixed(2), saved: false };
      }
    });
    setTaxas(newTaxas);

    setTimeout(() => {
      filteredOrders.forEach((o) => {
        saveTaxaMutation.mutate({ orderId: o.id, totalPrice: Number(o.total_price) });
      });
    }, 100);

    toast({ title: "Taxa aplicada e salva para todos os pedidos filtrados!" });
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
    conferidoAudits.forEach((a) => {
      const o = getAuditOrder(a);
      totalBruto += Number(o?.total_price || 0);
      totalTaxas += Number(a.taxa_valor);
    });
    return { totalBruto, totalTaxas, totalLiquido: totalBruto - totalTaxas };
  }, [conferidoAudits]);

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
          status: "conferido",
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
      toast({ title: `Pedidos movidos para Conferidos!` });
    },
    onError: (e: Error) => toast({ title: "Erro ao mover pedidos", description: e.message, variant: "destructive" }),
  });

  const devolver = useMutation({
    mutationFn: async (orderId: number) => {
      const { error } = await supabase
        .from("credit_card_audits")
        .update({ status: "pendente" })
        .eq("order_id", orderId);
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
    const rows = conferidoAudits.map((a) => {
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
          Pedidos finalizados/pagos com cartão. As taxas digitadas são salvas automaticamente no banco para relatórios.
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
              <Badge variant="secondary" className="ml-1 text-xs bg-green-100 text-green-800">{conferidoAudits.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* ── ABA: A CONFERIR ─────────────────────────────────────────────── */}
          <TabsContent value="a-conferir" className="space-y-4">

            {/* Aviso auto-save */}
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
              <Save className="w-3.5 h-3.5 shrink-0" />
              <span>As taxas são <strong>salvas automaticamente no banco</strong> ao sair de cada campo — ficam disponíveis para relatórios mesmo antes de conferir.</span>
            </div>

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
                  Aplicar e salvar todos
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
                          <TableHead className="text-xs text-center w-32">Líquido (R$)</TableHead>
                          <TableHead className="text-xs text-center w-16">Salvo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order) => {
                          const t = getTaxa(order.id);
                          const price = Number(order.total_price);
                          const tv = parseFloat(t.valor.replace(",", ".")) || 0;
                          const liquido = t.liquido !== "" ? parseFloat(t.liquido.replace(",", ".")) : price - tv;
                          const isSelected = selected.has(order.id);
                          const hasSavedInDb = !!pendingAuditMap[order.id];
                          const isSaving = t.saving;
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
                                  onBlur={() => handleTaxaBlur(order.id, price)}
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
                                  onBlur={() => handleTaxaBlur(order.id, price)}
                                  placeholder="0,00"
                                  className="h-7 text-xs text-center w-full"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={t.liquido}
                                  onChange={(e) => setTaxaLiquido(order.id, e.target.value, price)}
                                  onBlur={() => handleTaxaBlur(order.id, price)}
                                  placeholder={fmt(price)}
                                  className={`h-7 text-xs text-center w-full font-bold ${tv > 0 || t.liquido ? "text-green-700" : "text-muted-foreground"}`}
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                {isSaving ? (
                                  <RefreshCw className="w-3 h-3 animate-spin text-blue-400 mx-auto" />
                                ) : hasSavedInDb || t.saved ? (
                                  <span title="Salvo no banco" className="text-green-500 text-xs">✓</span>
                                ) : (
                                  <span className="text-gray-300 text-xs">—</span>
                                )}
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
                    const liquido = t.liquido !== "" ? parseFloat(t.liquido.replace(",", ".")) : price - tv;
                    const isSelected = selected.has(order.id);
                    const hasSavedInDb = !!pendingAuditMap[order.id];
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
                            {hasSavedInDb && <p className="text-[10px] text-green-600">✓ salvo</p>}
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
                              onBlur={() => handleTaxaBlur(order.id, price)}
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
                              onBlur={() => handleTaxaBlur(order.id, price)}
                              placeholder="0,00"
                              className="h-7 text-xs text-center"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] text-green-700 font-bold mb-1">Líquido R$</p>
                            <Input
                              type="number"
                              step="0.01"
                              value={t.liquido}
                              onChange={(e) => setTaxaLiquido(order.id, e.target.value, price)}
                              onBlur={() => handleTaxaBlur(order.id, price)}
                              placeholder={price.toFixed(2)}
                              className="h-7 text-xs text-center text-green-700 font-bold"
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
                  <p className="text-[11px] text-muted-foreground">{conferidoAudits.length} pedidos</p>
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

            {conferidoAudits.length === 0 ? (
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
                        {conferidoAudits.map((audit) => {
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
                  {conferidoAudits.map((audit) => {
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