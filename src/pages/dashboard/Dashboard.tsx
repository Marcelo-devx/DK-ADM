import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Package, TrendingUp, ShoppingBag, Truck, Wallet, AlertTriangle, Calendar, X, Ticket, QrCode, CreditCard, FileDown, Settings2, Coins, Info, Award, ChevronRight, ChevronDown, Package2 } from "lucide-react";
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
  // 1. Busca pedidos de clientes no período (para faturamento geral)
  let salesQuery = supabase
    .from("orders")
    .select("total_price, coupon_discount, created_at, payment_method, donation_amount, status")
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

  // 3. Busca produtos COM VARIANTES para cálculo preciso de estoque e custo
  const { data: products } = await supabase
    .from("products")
    .select(`
      id, 
      stock_quantity, 
      cost_price, 
      price, 
      name, 
      brand,
      variants:product_variants(
        price, 
        cost_price, 
        stock_quantity,
        flavors(name),
        color,
        size,
        ohms,
        volume_ml
      )
    `);
  const { data: promos } = await supabase.from("promotions").select("stock_quantity, price, name");

  // 4. Busca total de pontos distribuídos (saldo atual de todos os perfis)
  const { data: profilesPoints } = await supabase.from("profiles").select("points");
  // Garantir que somamos números (evita concatenação quando points for string)
  const totalPointsDistributed = (profilesPoints || []).reduce((acc, p) => acc + Number(p.points || 0), 0);
  const activeLoyaltyUsers = (profilesPoints || []).filter(p => Number(p.points || 0) > 0).length;

  const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total_price || 0), 0);
  const totalDiscount = sales.reduce((acc, s) => acc + Number(s.coupon_discount || 0), 0);
  const totalCouponsCount = sales.filter(s => Number(s.coupon_discount || 0) > 0).length;

  const pixRevenue = sales.filter(s => (s.payment_method || 'pix').toLowerCase().includes('pix')).reduce((acc, s) => acc + Number(s.total_price || 0), 0);
  const cardRevenue = sales.filter(s => (s.payment_method || '').toLowerCase().includes('cart')).reduce((acc, s) => acc + Number(s.total_price || 0), 0);

  // CALCULA VALOR DE ESTOQUE COM PRECISÃO - CONSIDERA CUSTOS DAS VARIANTES
  const inventoryCostValue = (products || []).reduce((total, product) => {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    
    if (variants.length > 0) {
      // Produto com variantes - somar custo individual de cada variação
      return total + variants.reduce((sum, v) => 
        sum + (Number(v.stock_quantity) * Number(v.cost_price || 0)), 0
      );
    } else {
      // Produto sem variantes - usar custo base do produto
      return total + (Number(product.stock_quantity) * Number(product.cost_price || 0));
    }
  }, 0);

  // CALCULA POTENCIAL DE RECEITA COM PRECISÃO - CONSIDERA PREÇOS DAS VARIANTES
  const potentialRevenueValue = [
    ...(products || []).map(product => {
      const variants = Array.isArray(product.variants) ? product.variants : [];
      
      if (variants.length > 0) {
        // Produto com variantes - somar valor de cada variação
        return variants.reduce((sum, v) => 
          sum + (Number(v.stock_quantity) * Number(v.price || 0)), 0
        );
      } else {
        // Produto sem variantes - usar preço base
        return Number(product.stock_quantity) * Number(product.price || 0);
      }
    }),
    ...(promos || []).map(p => (p.stock_quantity * (p.price || 0)))
  ].reduce((acc, val) => acc + val, 0);

  // CALCULA TOTAL DE DOAÇÕES - APENAS DE PEDIDOS PAGOS
  const paidSales = sales.filter(s => s.status === 'Pago');
  const totalDonations = paidSales.reduce((acc, s) => acc + Number(s.donation_amount || 0), 0);

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
    totalDonations,
    rawProducts: products || [],
    rawPromos: promos || []
  };
};

const formatVariantSpec = (variant: any) => {
  const parts = [];
  if (variant.flavors?.name) parts.push(variant.flavors.name);
  if (variant.volume_ml) parts.push(`${variant.volume_ml}ml`);
  if (variant.size) parts.push(variant.size);
  if (variant.color) parts.push(variant.color);
  if (variant.ohms) parts.push(variant.ohms);
  return parts.join(' | ') || 'Sem especificação';
};

const DashboardPage = () => {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [stockThreshold, setStockThreshold] = useState(10);
  const [expandedProducts, setExpandedProducts] = useState<Record<number, boolean>>({});

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["dashboardFinancialStats", startDate, endDate],
    queryFn: () => fetchFinancialSummary(startDate, endDate),
    refetchInterval: 60000,
  });

  const criticalItems = useMemo(() => {
    if (!stats) return [];
    
    const items: any[] = [];
    
    // Processar produtos com variações
    stats.rawProducts.forEach(product => {
      const variants = Array.isArray(product.variants) ? product.variants : [];
      
      if (variants.length > 0) {
        // Produto tem variações - buscar variações com estoque baixo
        const lowStockVariants = variants.filter(v => v.stock_quantity <= stockThreshold);
        
        if (lowStockVariants.length > 0) {
          items.push({
            id: product.id,
            name: product.name,
            stock: product.stock_quantity,
            type: 'Produto',
            brand: product.brand,
            hasVariants: true,
            variants: lowStockVariants
          });
        }
      } else {
        // Produto sem variações - usar estoque total
        if (product.stock_quantity <= stockThreshold) {
          items.push({
            id: product.id,
            name: product.name,
            stock: product.stock_quantity,
            type: 'Produto',
            brand: product.brand,
            hasVariants: false,
            variants: []
          });
        }
      }
    });
    
    // Adicionar promoções (sem alterações)
    stats.rawPromos.filter(p => p.stock_quantity <= stockThreshold).forEach(p => {
      items.push({
        name: `[KIT] ${p.name}`,
        stock: p.stock_quantity,
        type: 'Promoção',
        brand: '-',
        hasVariants: false,
        variants: []
      });
    });
    
    return items.sort((a, b) => a.stock - b.stock);
  }, [stats, stockThreshold]);

  const toggleProductExpansion = (productId: number) => {
    setExpandedProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

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

        <Card className="border-l-4 border-l-rose-500 shadow-sm bg-rose-50/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Doações</CardTitle>
            <Info className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-700">{formatCurrency(stats?.totalDonations || 0)}</div>
            <p className="text-xs text-muted-foreground">Arrecadado no período</p>
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
                    <TableHeader className="bg-gray-50"><TableRow><TableHead className="w-10"></TableHead><TableHead>Nome do Item</TableHead><TableHead>Tipo</TableHead><TableHead className="text-center">Qtd. Estoque</TableHead><TableHead className="text-right">Ação Sugerida</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {criticalItems.map((item, i) => (
                        <>
                          {/* Linha do produto */}
                          <TableRow 
                            className={cn(
                              item.stock === 0 && "bg-red-50/50",
                              item.hasVariants && expandedProducts[item.id] && "bg-blue-50/30"
                            )}
                          >
                            {/* Coluna de expansão (apenas para produtos com variações) */}
                            <TableCell className="w-10">
                              {item.hasVariants ? (
                                <button 
                                  onClick={() => toggleProductExpansion(item.id)}
                                  className="p-1 hover:bg-gray-200 rounded transition"
                                >
                                  {expandedProducts[item.id] ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                              ) : null}
                            </TableCell>
                            
                            <TableCell className="font-medium">
                              {item.name}
                              <p className="text-[10px] text-muted-foreground uppercase">{item.brand}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={item.stock === 0 ? "destructive" : item.stock <= 5 ? "destructive" : "secondary"}>
                                {item.stock} un
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-xs font-bold text-orange-600">
                                {item.stock === 0 ? "COMPRA URGENTE" : "REPOR ESTOQUE"}
                              </span>
                            </TableCell>
                          </TableRow>
                          
                          {/* Linhas de variações expandidas */}
                          {item.hasVariants && expandedProducts[item.id] && item.variants.map((variant: any, vIdx: number) => (
                            <TableRow key={`${i}-variant-${vIdx}`} className="bg-gray-50/50 hover:bg-gray-100/50">
                              <TableCell></TableCell> {/* Espaço vazio */}
                              <TableCell className="font-medium pl-4">
                                <div className="flex items-center gap-2">
                                  <Package2 className="h-3 w-3 text-primary" />
                                  <span className="text-xs">{formatVariantSpec(variant)}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-[10px]">Variação</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={variant.stock_quantity === 0 ? "destructive" : "secondary"} className="text-[10px]">
                                  {variant.stock_quantity} un
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-xs font-bold text-orange-600">
                                  {variant.stock_quantity === 0 ? "COMPRA URGENTE" : "REPOR ESTOQUE"}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </>
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