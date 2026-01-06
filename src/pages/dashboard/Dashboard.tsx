import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Package, TrendingUp, ShoppingBag, Truck, Wallet, AlertTriangle, Calendar, X, Ticket, QrCode, CreditCard, FileDown, Settings2, Coins, Info, Award } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { startOfMonth, format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const fetchFinancialSummary = async (startDate?: string, endDate?: string) => {
  // 1. Busca pedidos de clientes no período
  let salesQuery = supabase
    .from("orders")
    .select("total_price, coupon_discount, created_at, payment_method")
    .in("status", ["Finalizada", "Pago"]);

  if (startDate) salesQuery = salesQuery.gte("created_at", startDate);
  if (endDate) salesQuery = salesQuery.lte("created_at", endDate + "T23:59:59");

  const { data: salesRaw, error: salesError } = await salesQuery;
  if (salesError) throw salesError;
  const sales = salesRaw || [];

  // 2. Busca nomes dos cupons usados
  const { data: usedCouponsRaw, error: couponsError } = await supabase
    .from("user_coupons")
    .select("created_at, coupons(name)")
    .eq("is_used", true);
  
  if (couponsError) throw couponsError;

  const usedInPeriod = (usedCouponsRaw || []).filter(uc => {
    if (!startDate || !endDate) return true;
    const date = new Date(uc.created_at);
    return date >= new Date(startDate) && date <= new Date(endDate + "T23:59:59");
  });

  const couponStats = usedInPeriod.reduce((acc: Record<string, number>, curr: any) => {
    const couponData = Array.isArray(curr.coupons) ? curr.coupons[0] : curr.coupons;
    const name = couponData?.name || "Desconhecido";
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  // 3. Busca produtos e promos para estoque
  const { data: products } = await supabase.from("products").select("stock_quantity, cost_price, price, name, brand");
  const { data: promos } = await supabase.from("promotions").select("stock_quantity, price, name");

  // 4. Busca total de pontos distribuídos (saldo atual de todos os perfis)
  const { data: profilesPoints } = await supabase.from("profiles").select("points");
  const totalPointsDistributed = (profilesPoints || []).reduce((acc, p) => acc + (p.points || 0), 0);
  const activeLoyaltyUsers = (profilesPoints || []).filter(p => p.points > 0).length;

  const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total_price || 0), 0);
  const totalDiscount = sales.reduce((acc, s) => acc + Number(s.coupon_discount || 0), 0);
  const totalCouponsCount = sales.filter(s => Number(s.coupon_discount || 0) > 0).length;

  const pixRevenue = sales.filter(s => (s.payment_method || 'pix').toLowerCase().includes('pix')).reduce((acc, s) => acc + Number(s.total_price || 0), 0);
  const cardRevenue = sales.filter(s => (s.payment_method || '').toLowerCase().includes('cart')).reduce((acc, s) => acc + Number(s.total_price || 0), 0);

  const inventoryCostValue = (products || []).reduce((acc, p) => acc + (p.stock_quantity * (p.cost_price || 0)), 0);
  const potentialRevenueValue = [
    ...(products || []).map(p => (p.stock_quantity * (p.price || 0))),
    ...(promos || []).map(p => (p.stock_quantity * (p.price || 0)))
  ].reduce((acc, val) => acc + val, 0);

  return {
    totalRevenue,
    totalSalesCount: sales.length,
    pixRevenue,
    cardRevenue,
    totalDiscount,
    totalCouponsCount,
    couponStats,
    inventoryCostValue,
    potentialRevenueValue,
    totalPointsDistributed,
    activeLoyaltyUsers,
    rawProducts: products || [],
    rawPromos: promos || []
  };
};

const DashboardPage = () => {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [stockThreshold, setStockThreshold] = useState(10);

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["dashboardFinancialStats", startDate, endDate],
    queryFn: () => fetchFinancialSummary(startDate, endDate),
    refetchInterval: 60000,
  });

  const criticalItems = useMemo(() => {
    if (!stats) return [];
    return [
      ...stats.rawProducts.filter(p => p.stock_quantity <= stockThreshold).map(p => ({ name: p.name, stock: p.stock_quantity, type: 'Produto', brand: p.brand })),
      ...stats.rawPromos.filter(p => p.stock_quantity <= stockThreshold).map(p => ({ name: `[KIT] ${p.name}`, stock: p.stock_quantity, type: 'Promoção', brand: '-' }))
    ].sort((a, b) => a.stock - b.stock);
  }, [stats, stockThreshold]);

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  if (isLoading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel de Gestão</h1>
          <p className="text-muted-foreground">Análise de desempenho e saúde financeira.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">De</span>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 w-36 text-xs" />
            </div>
          </div>
          <div className="flex items-center gap-2 border-l pl-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Até</span>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 w-36 text-xs" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card className="border-l-4 border-l-green-600 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Líquido</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">{stats?.totalSalesCount} vendas no período</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-pink-500 shadow-sm relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Descontos Concedidos</CardTitle>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Ticket className="h-4 w-4 text-pink-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="w-64 p-3">
                        <p className="font-bold border-b pb-1 mb-2">Tipos de Cupons Usados:</p>
                        {stats?.couponStats && Object.keys(stats.couponStats).length > 0 ? (
                            Object.entries(stats.couponStats).map(([name, count]) => (
                                <div key={name} className="flex justify-between text-xs py-1">
                                    <span>{name}</span>
                                    <span className="font-bold text-pink-600">{count}x</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs italic text-muted-foreground">Nenhum cupom específico identificado.</p>
                        )}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-pink-600">{formatCurrency(stats?.totalDiscount || 0)}</div>
            <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-muted-foreground font-medium">
                    {stats?.totalCouponsCount || 0} cupons aplicados
                </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 shadow-sm bg-yellow-50/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pontos Distribuídos</CardTitle>
            <Award className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{stats?.totalPointsDistributed?.toLocaleString()} pts</div>
            <p className="text-xs text-muted-foreground">{stats?.activeLoyaltyUsers} clientes com saldo</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Investimento em Estoque</CardTitle>
            <Wallet className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.inventoryCostValue || 0)}</div>
            <p className="text-xs text-muted-foreground">Capital preso (valor de custo)</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-600 shadow-sm bg-blue-50/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Potencial de Recebimento</CardTitle>
            <Coins className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{formatCurrency(stats?.potentialRevenueValue || 0)}</div>
            <p className="text-xs text-muted-foreground">Valor total (preço de venda)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-cyan-50/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total via Pix</CardTitle>
                <QrCode className="h-4 w-4 text-cyan-600" />
            </CardHeader>
            <CardContent>
                <div className="text-xl font-bold text-cyan-700">{formatCurrency(stats?.pixRevenue || 0)}</div>
                <p className="text-xs text-muted-foreground">Dinheiro imediato em conta</p>
            </CardContent>
        </Card>
        <Card className="bg-purple-50/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total via Cartão</CardTitle>
                <CreditCard className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
                <div className="text-xl font-bold text-purple-700">{formatCurrency(stats?.cardRevenue || 0)}</div>
                <p className="text-xs text-muted-foreground">Vendas a processar/crédito</p>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div><CardTitle className="text-lg">Gestão de Reposição de Estoque</CardTitle><p className="text-sm text-muted-foreground">Itens com estoque igual ou inferior ao limite definido.</p></div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1">
                <Label htmlFor="threshold" className="text-[10px] font-bold uppercase text-muted-foreground">Limite de Alerta</Label>
                <div className="flex items-center gap-2">
                    <Input id="threshold" type="number" value={stockThreshold} onChange={(e) => setStockThreshold(Number(e.target.value))} className="w-20 h-9 font-bold border-primary/20" />
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {criticalItems.length > 0 ? (
            <div className="border rounded-xl overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-gray-50"><TableRow><TableHead>Nome do Item</TableHead><TableHead>Tipo</TableHead><TableHead className="text-center">Qtd. Estoque</TableHead><TableHead className="text-right">Ação Sugerida</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {criticalItems.map((item, i) => (
                        <TableRow key={i} className={cn(item.stock === 0 && "bg-red-50/50")}>
                        <TableCell className="font-medium">{item.name}<p className="text-[10px] text-muted-foreground uppercase">{item.brand}</p></TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{item.type}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant={item.stock === 0 ? "destructive" : item.stock <= 5 ? "destructive" : "secondary"}>{item.stock} un</Badge></TableCell>
                        <TableCell className="text-right"><span className="text-xs font-bold text-orange-600">{item.stock === 0 ? "COMPRA URGENTE" : "REPOR ESTOQUE"}</span></TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </div>
          ) : (
            <p className="text-center py-10 text-muted-foreground bg-gray-50 rounded-xl border-2 border-dashed">Nenhum item com estoque igual ou abaixo de {stockThreshold} unidades. Tudo em dia!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;