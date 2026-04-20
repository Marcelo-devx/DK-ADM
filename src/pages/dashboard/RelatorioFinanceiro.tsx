import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileDown, RefreshCw, CheckCircle2, XCircle, AlertCircle,
  Clock, TrendingUp, QrCode, CreditCard, Ticket, Heart, ShieldAlert,
} from "lucide-react";

const STATUSES_DASHBOARD = ["Finalizada", "Pago"];

const fetchAllOrders = async (startDate: string, endDate: string) => {
  const { data, error } = await supabase
    .from("orders")
    .select("id, created_at, status, total_price, coupon_discount, donation_amount, payment_method, guest_email, user_id")
    .gte("created_at", startDate)
    .lte("created_at", endDate + "T23:59:59")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

const fmt = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const fmtDate = (iso: string) =>
  format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });

const statusColor: Record<string, string> = {
  Pago: "bg-green-100 text-green-800 border-green-300",
  Finalizada: "bg-blue-100 text-blue-800 border-blue-300",
  Pendente: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Cancelado: "bg-red-100 text-red-800 border-red-300",
  "Em andamento": "bg-orange-100 text-orange-800 border-orange-300",
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "Pago" || status === "Finalizada") return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />;
  if (status === "Cancelado") return <XCircle className="w-3.5 h-3.5 text-red-600" />;
  if (status === "Pendente") return <Clock className="w-3.5 h-3.5 text-yellow-600" />;
  return <AlertCircle className="w-3.5 h-3.5 text-orange-600" />;
};

const RelatorioFinanceiro = () => {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterPayment, setFilterPayment] = useState("todos");

  const { data: orders = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["relatorio-financeiro", startDate, endDate],
    queryFn: () => fetchAllOrders(startDate, endDate),
    staleTime: 0,
  });

  const allStatuses = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    orders.forEach((o) => {
      const s = o.status || "Desconhecido";
      if (!map[s]) map[s] = { count: 0, total: 0 };
      map[s].count++;
      map[s].total += Number(o.total_price || 0);
    });
    return map;
  }, [orders]);

  const dashboardOrders = useMemo(() => orders.filter((o) => STATUSES_DASHBOARD.includes(o.status)), [orders]);
  const dashboardTotal = dashboardOrders.reduce((acc, o) => acc + Number(o.total_price || 0), 0);
  const dashboardPix = dashboardOrders.filter((o) => (o.payment_method || "pix").toLowerCase().includes("pix")).reduce((acc, o) => acc + Number(o.total_price || 0), 0);
  const dashboardCard = dashboardOrders.filter((o) => (o.payment_method || "").toLowerCase().includes("cart")).reduce((acc, o) => acc + Number(o.total_price || 0), 0);
  const dashboardDiscount = dashboardOrders.reduce((acc, o) => acc + Number(o.coupon_discount || 0), 0);
  const dashboardDonations = dashboardOrders.filter((o) => o.status === "Pago").reduce((acc, o) => acc + Number(o.donation_amount || 0), 0);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const statusOk = filterStatus === "todos" || o.status === filterStatus;
      const pm = (o.payment_method || "pix").toLowerCase();
      const paymentOk =
        filterPayment === "todos" ||
        (filterPayment === "pix" && pm.includes("pix")) ||
        (filterPayment === "cartao" && pm.includes("cart")) ||
        (filterPayment === "outros" && !pm.includes("pix") && !pm.includes("cart"));
      return statusOk && paymentOk;
    });
  }, [orders, filterStatus, filterPayment]);

  const filteredTotal = filteredOrders.reduce((acc, o) => acc + Number(o.total_price || 0), 0);

  const exportCSV = () => {
    const header = ["ID", "Data", "Status", "Pagamento", "Total (R$)", "Desconto (R$)", "Doação (R$)", "No Dashboard?", "Usuário/Email"].join(";");
    const rows = filteredOrders.map((o) => {
      const inDash = STATUSES_DASHBOARD.includes(o.status) ? "SIM" : "NÃO";
      const who = o.guest_email || o.user_id || "-";
      return [o.id, fmtDate(o.created_at), o.status, o.payment_method || "Pix",
        Number(o.total_price || 0).toFixed(2).replace(".", ","),
        Number(o.coupon_discount || 0).toFixed(2).replace(".", ","),
        Number(o.donation_amount || 0).toFixed(2).replace(".", ","),
        inDash, who].join(";");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio_${startDate}_${endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueStatuses = Object.keys(allStatuses).sort();

  return (
    <div className="space-y-5 p-1">
      {/* Header */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <span className="text-xs font-bold uppercase tracking-widest text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">Acesso Restrito</span>
          </div>
          <h1 className="text-xl font-black tracking-tight">Relatório Financeiro</h1>
          <p className="text-xs text-muted-foreground">Todos os pedidos do período, incluindo cancelados e pendentes.</p>
        </div>

        {/* Filtros de data + ações */}
        <div className="bg-white p-3 rounded-xl border shadow-sm space-y-2">
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">De</span>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 w-36 text-xs" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Até</span>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 w-36 text-xs" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="h-8 flex-1">
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
            </Button>
            <Button size="sm" onClick={exportCSV} className="h-8 flex-1">
              <FileDown className="w-3.5 h-3.5 mr-1" /> Exportar CSV
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>
      ) : (
        <>
          {/* Cards de resumo */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" /> Dashboard (Finalizada + Pago)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              <Card className="border-l-4 border-l-green-600">
                <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs text-muted-foreground font-medium">Faturamento</CardTitle></CardHeader>
                <CardContent className="px-3 pb-3"><p className="text-base font-black text-green-700">{fmt(dashboardTotal)}</p><p className="text-[11px] text-muted-foreground">{dashboardOrders.length} pedidos</p></CardContent>
              </Card>
              <Card className="border-l-4 border-l-cyan-500">
                <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1"><QrCode className="w-3 h-3" />Pix</CardTitle></CardHeader>
                <CardContent className="px-3 pb-3"><p className="text-base font-black text-cyan-700">{fmt(dashboardPix)}</p></CardContent>
              </Card>
              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1"><CreditCard className="w-3 h-3" />Cartão</CardTitle></CardHeader>
                <CardContent className="px-3 pb-3"><p className="text-base font-black text-purple-700">{fmt(dashboardCard)}</p></CardContent>
              </Card>
              <Card className="border-l-4 border-l-pink-500">
                <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1"><Ticket className="w-3 h-3" />Descontos</CardTitle></CardHeader>
                <CardContent className="px-3 pb-3"><p className="text-base font-black text-pink-700">{fmt(dashboardDiscount)}</p></CardContent>
              </Card>
              <Card className="border-l-4 border-l-rose-500 col-span-2 md:col-span-1">
                <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1"><Heart className="w-3 h-3" />Doações</CardTitle></CardHeader>
                <CardContent className="px-3 pb-3"><p className="text-base font-black text-rose-700">{fmt(dashboardDonations)}</p><p className="text-[11px] text-muted-foreground">só "Pago"</p></CardContent>
              </Card>
            </div>
          </div>

          {/* Breakdown por status */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Breakdown por Status</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {uniqueStatuses.map((status) => {
                const { count, total } = allStatuses[status];
                const inDash = STATUSES_DASHBOARD.includes(status);
                return (
                  <Card key={status} className={`border ${inDash ? "border-green-300 bg-green-50/30" : "border-gray-200"}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1 gap-1 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${statusColor[status] || "bg-gray-100 text-gray-700 border-gray-300"}`}>{status}</span>
                        {inDash ? (
                          <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">✓</span>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">✗</span>
                        )}
                      </div>
                      <p className="text-base font-black">{fmt(total)}</p>
                      <p className="text-xs text-muted-foreground">{count} pedido{count !== 1 ? "s" : ""}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Tabela detalhada */}
          <div>
            <div className="flex flex-col gap-2 mb-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Pedidos ({filteredOrders.length} · {fmt(filteredTotal)})
              </p>
              <div className="flex gap-2 flex-wrap">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-8 flex-1 min-w-[130px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    {uniqueStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterPayment} onValueChange={setFilterPayment}>
                  <SelectTrigger className="h-8 flex-1 min-w-[130px] text-xs"><SelectValue placeholder="Pagamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mobile: cards */}
            <div className="md:hidden space-y-2">
              {filteredOrders.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Nenhum pedido encontrado.</p>
              ) : filteredOrders.map((order) => {
                const inDash = STATUSES_DASHBOARD.includes(order.status);
                const pm = order.payment_method || "Pix";
                const isPix = pm.toLowerCase().includes("pix");
                const isCard = pm.toLowerCase().includes("cart");
                return (
                  <div key={order.id} className={`rounded-xl border p-3 space-y-2 ${!inDash ? "opacity-60 bg-gray-50" : "bg-white"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">#{order.id}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(order.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">{fmt(Number(order.total_price || 0))}</p>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor[order.status] || "bg-gray-100 text-gray-700 border-gray-300"}`}>
                          <StatusIcon status={order.status} />{order.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {isPix ? <QrCode className="w-3 h-3 text-cyan-600" /> : isCard ? <CreditCard className="w-3 h-3 text-purple-600" /> : null}
                        {pm}
                      </span>
                      <div className="flex gap-2">
                        {Number(order.coupon_discount || 0) > 0 && <span className="text-pink-700 font-semibold">-{fmt(Number(order.coupon_discount))}</span>}
                        {Number(order.donation_amount || 0) > 0 && <span className="text-rose-700 font-semibold">♥{fmt(Number(order.donation_amount))}</span>}
                        {inDash ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-400" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden md:block border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="text-xs w-20">ID</TableHead>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Pagamento</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">Desconto</TableHead>
                      <TableHead className="text-xs text-right">Doação</TableHead>
                      <TableHead className="text-xs text-center">Dashboard?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum pedido encontrado.</TableCell></TableRow>
                    ) : filteredOrders.map((order) => {
                      const inDash = STATUSES_DASHBOARD.includes(order.status);
                      const pm = order.payment_method || "Pix";
                      const isPix = pm.toLowerCase().includes("pix");
                      const isCard = pm.toLowerCase().includes("cart");
                      return (
                        <TableRow key={order.id} className={!inDash ? "opacity-60 bg-gray-50/50" : ""}>
                          <TableCell className="font-mono text-xs text-muted-foreground">#{order.id}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{fmtDate(order.created_at)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor[order.status] || "bg-gray-100 text-gray-700 border-gray-300"}`}>
                              <StatusIcon status={order.status} />{order.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              {isPix ? <QrCode className="w-3 h-3 text-cyan-600" /> : isCard ? <CreditCard className="w-3 h-3 text-purple-600" /> : null}
                              {pm}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-bold text-sm">{fmt(Number(order.total_price || 0))}</TableCell>
                          <TableCell className="text-right text-xs text-pink-700">{Number(order.coupon_discount || 0) > 0 ? fmt(Number(order.coupon_discount)) : <span className="text-gray-300">—</span>}</TableCell>
                          <TableCell className="text-right text-xs text-rose-700">{Number(order.donation_amount || 0) > 0 ? fmt(Number(order.donation_amount)) : <span className="text-gray-300">—</span>}</TableCell>
                          <TableCell className="text-center">{inDash ? <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /> : <XCircle className="w-4 h-4 text-red-400 mx-auto" />}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {filteredOrders.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3 justify-end text-sm">
                <span className="text-muted-foreground">Total: <strong className="text-foreground">{fmt(filteredTotal)}</strong></span>
                <span className="text-muted-foreground">Descontos: <strong className="text-pink-700">{fmt(filteredOrders.reduce((a, o) => a + Number(o.coupon_discount || 0), 0))}</strong></span>
                <span className="text-muted-foreground">Doações: <strong className="text-rose-700">{fmt(filteredOrders.reduce((a, o) => a + Number(o.donation_amount || 0), 0))}</strong></span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default RelatorioFinanceiro;
