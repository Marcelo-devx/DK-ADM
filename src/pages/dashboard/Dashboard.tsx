import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Package, TrendingUp, Wallet, AlertTriangle, Calendar, Ticket, QrCode, CreditCard, Coins, Info, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { startOfMonth, format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const fetchFinancialSummary = async (startDate?: string, endDate?: string) => {
  let salesQuery = supabase
    .from("orders")
    .select("total_price, coupon_discount, created_at, payment_method, donation_amount, status")
    .in("status", ["Finalizada", "Pago"]);

  if (startDate) salesQuery = salesQuery.gte("created_at", startDate);
  if (endDate) salesQuery = salesQuery.lte("created_at", endDate + "T23:59:59");

  const { data: salesRaw, error: salesError } = await salesQuery;
  if (salesError) throw salesError;
  const sales = salesRaw || [];

  const { data: usedCouponsRaw } = await supabase
    .from("user_coupons")
    .select("created_at, coupons(name)")
    .eq("is_used", true);

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

  const { data: products } = await supabase
    .from("products")
    .select(`id, stock_quantity, cost_price, price, name, brand, variants:product_variants(price, cost_price, stock_quantity, flavors(name), color, size, ohms, volume_ml)`);
  const { data: promos } = await supabase.from("promotions").select("stock_quantity, price, name");

  const { data: profilesPoints } = await supabase.from("profiles").select("points");
  const totalPointsDistributed = (profilesPoints || []).reduce((acc, p) => acc + Number(p.points || 0), 0);
  const activeLoyaltyUsers = (profilesPoints || []).filter(p => Number(p.points || 0) > 0).length;

  const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total_price || 0), 0);
  const totalDiscount = sales.reduce((acc, s) => acc + Number(s.coupon_discount || 0), 0);
  const totalCouponsCount = sales.filter(s => Number(s.coupon_discount || 0) > 0).length;
  const pixRevenue = sales.filter(s => (s.payment_method || "pix").toLowerCase().includes("pix")).reduce((acc, s) => acc + Number(s.total_price || 0), 0);
  const cardRevenue = sales.filter(s => (s.payment_method || "").toLowerCase().includes("cart")).reduce((acc, s) => acc + Number(s.total_price || 0), 0);

  const inventoryCostValue = (products || []).reduce((total, product) => {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (variants.length > 0) return total + variants.reduce((sum, v) => sum + (Number(v.stock_quantity) * Number(v.cost_price || 0)), 0);
    return total + (Number(product.stock_quantity) * Number(product.cost_price || 0));
  }, 0);

  const potentialRevenueValue = [
    ...(products || []).map(product => {
      const variants = Array.isArray(product.variants) ? product.variants : [];
      if (variants.length > 0) return variants.reduce((sum, v) => sum + (Number(v.stock_quantity) * Number(v.price || 0)), 0);
      return Number(product.stock_quantity) * Number(product.price || 0);
    }),
    ...(promos || []).map(p => (p.stock_quantity * (p.price || 0)))
  ].reduce((acc, val) => acc + val, 0);

  const paidSales = sales.filter(s => s.status === "Pago");
  const totalDonations = paidSales.reduce((acc, s) => acc + Number(s.donation_amount || 0), 0);

  return {
    totalRevenue, totalSalesCount: sales.length, pixRevenue, cardRevenue,
    totalDiscount, totalCouponsCount, couponStats,
    inventoryCostValue, potentialRevenueValue,
    totalPointsDistributed, activeLoyaltyUsers, totalDonations,
    rawProducts: products || [], rawPromos: promos || []
  };
};

const formatVariantSpec = (variant: any) => {
  const parts = [];
  if (variant.flavors?.name) parts.push(variant.flavors.name);
  if (variant.volume_ml) parts.push(`${variant.volume_ml}ml`);
  if (variant.size) parts.push(variant.size);
  if (variant.color) parts.push(variant.color);
  if (variant.ohms) parts.push(variant.ohms);
  return parts.join(" | ") || "Sem especificação";
};

const DashboardPage = () => {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [stockThreshold] = useState(10);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboardFinancialStats", startDate, endDate],
    queryFn: () => fetchFinancialSummary(startDate, endDate),
    refetchInterval: 60000,
  });

  const criticalItems = useMemo(() => {
    if (!stats) return [];
    const items: any[] = [];
    stats.rawProducts.forEach(product => {
      const variants = Array.isArray(product.variants) ? product.variants : [];
      if (variants.length > 0) {
        const lowStockVariants = variants.filter(v => v.stock_quantity <= stockThreshold);
        if (lowStockVariants.length > 0) items.push({ id: product.id, name: product.name, stock: product.stock_quantity, type: "Produto", brand: product.brand, hasVariants: true, variants: lowStockVariants });
      } else {
        if (product.stock_quantity <= stockThreshold) items.push({ id: product.id, name: product.name, stock: product.stock_quantity, type: "Produto", brand: product.brand, hasVariants: false, variants: [] });
      }
    });
    stats.rawPromos.filter(p => p.stock_quantity <= stockThreshold).forEach(p => {
      items.push({ name: `[KIT] ${p.name}`, stock: p.stock_quantity, type: "Promoção", brand: "-", hasVariants: false, variants: [] });
    });
    return items.sort((a, b) => a.stock - b.stock);
  }, [stats, stockThreshold]);

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  if (isLoading) return <div className="p-4 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6">
      {/* Header + filtro de datas */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Painel de Gestão</h1>
          <p className="text-sm text-muted-foreground">Análise de desempenho e saúde financeira.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 bg-white p-3 rounded-xl border shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">De</span>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 w-36 text-xs" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Até</span>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 w-36 text-xs" />
          </div>
        </div>
      </div>

      {/* KPI cards — 2 colunas no mobile, 3 no md, 5 no xl */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        <Card className="border-l-4 border-l-green-600 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-medium">Faturamento</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold leading-tight">{formatCurrency(stats?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">{stats?.totalSalesCount} vendas</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-pink-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-medium">Descontos</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Ticket className="h-4 w-4 text-pink-500 cursor-help shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="w-64 p-3">
                  <p className="font-bold border-b pb-1 mb-2">Cupons Usados:</p>
                  {stats?.couponStats && Object.keys(stats.couponStats).length > 0 ? (
                    Object.entries(stats.couponStats).map(([name, count]) => (
                      <div key={name} className="flex justify-between text-xs py-1">
                        <span>{name}</span>
                        <span className="font-bold text-pink-600">{count}x</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs italic text-muted-foreground">Nenhum cupom identificado.</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold text-pink-600 leading-tight">{formatCurrency(stats?.totalDiscount || 0)}</div>
            <p className="text-xs text-muted-foreground">{stats?.totalCouponsCount || 0} cupons</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-medium">Pontos</CardTitle>
            <Award className="h-4 w-4 text-yellow-600 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold text-yellow-700 leading-tight">{stats?.totalPointsDistributed?.toLocaleString()} pts</div>
            <p className="text-xs text-muted-foreground">{stats?.activeLoyaltyUsers} clientes</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-medium">Doações</CardTitle>
            <Info className="h-4 w-4 text-rose-600 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold text-rose-700 leading-tight">{formatCurrency(stats?.totalDonations || 0)}</div>
            <p className="text-xs text-muted-foreground">no período</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-medium">Estoque (custo)</CardTitle>
            <Wallet className="h-4 w-4 text-orange-500 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold leading-tight">{formatCurrency(stats?.inventoryCostValue || 0)}</div>
            <p className="text-xs text-muted-foreground">capital preso</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-600 shadow-sm col-span-2 md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-medium">Potencial</CardTitle>
            <Coins className="h-4 w-4 text-blue-600 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold text-blue-700 leading-tight">{formatCurrency(stats?.potentialRevenueValue || 0)}</div>
            <p className="text-xs text-muted-foreground">valor de venda</p>
          </CardContent>
        </Card>
      </div>

      {/* Pix + Cartão */}
      <div className="grid gap-3 grid-cols-2">
        <Card className="bg-cyan-50/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-medium">Via Pix</CardTitle>
            <QrCode className="h-4 w-4 text-cyan-600 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold text-cyan-700 leading-tight">{formatCurrency(stats?.pixRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">imediato em conta</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-medium">Via Cartão</CardTitle>
            <CreditCard className="h-4 w-4 text-purple-600 shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold text-purple-700 leading-tight">{formatCurrency(stats?.cardRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">a processar</p>
          </CardContent>
        </Card>
      </div>

      {/* Estoque crítico */}
      {criticalItems.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/30">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
              <AlertTriangle className="w-4 h-4" /> Estoque Crítico ({criticalItems.length} itens)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {criticalItems.slice(0, 10).map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b border-orange-100 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                    {item.hasVariants && item.variants.length > 0 && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {item.variants.map((v: any) => formatVariantSpec(v)).join(", ")}
                      </p>
                    )}
                  </div>
                  <Badge variant={item.stock === 0 ? "destructive" : "outline"} className={cn("shrink-0 text-xs font-bold", item.stock > 0 && "text-orange-600 border-orange-300 bg-orange-50")}>
                    {item.stock === 0 ? "ESGOTADO" : `${item.stock} un`}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardPage;
