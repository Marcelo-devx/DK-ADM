"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, DollarSign, Users, Calendar, HandHeart, X, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DonationOrder {
  id: number;
  donation_amount: number;
  created_at: string;
  status: string;
  user_id: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

const fetchDonations = async (): Promise<DonationOrder[]> => {
  // 1. Busca pedidos com doação > 0 e que foram pagos
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, donation_amount, created_at, status, user_id")
    .gt('donation_amount', 0)
    .in('status', ['Pago', 'Finalizada'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!orders || orders.length === 0) return [];

  // 2. Coleta IDs únicos de usuários para buscar os perfis
  const userIds = [...new Set(orders.map(o => o.user_id))];
  
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", userIds);

  if (profilesError) {
      console.warn("Erro ao buscar perfis dos doadores:", profilesError.message);
      return orders as DonationOrder[];
  }

  const profilesMap = new Map(profiles.map(p => [p.id, p]));

  // 3. Mescla os dados
  return orders.map(order => ({
    ...order,
    profiles: profilesMap.get(order.user_id) || null,
  })) as DonationOrder[];
};

export default function DonationsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: donations, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["donations-list-v4"],
    queryFn: fetchDonations,
  });

  const filteredDonations = useMemo(() => {
    if (!donations) return [];
    return donations.filter((order) => {
      const orderDate = new Date(order.created_at);
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (orderDate < start) return false;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (orderDate > end) return false;
      }
      
      return true;
    });
  }, [donations, startDate, endDate]);

  const stats = useMemo(() => {
      return filteredDonations.reduce((acc, order) => {
        const value = Number(order.donation_amount || 0);
        acc.total += value;
        acc.count += 1;
        return acc;
      }, { total: 0, count: 0 });
  }, [filteredDonations]);

  const uniqueDonors = useMemo(() => new Set(filteredDonations.map(d => d.user_id)).size, [filteredDonations]);
  const averageDonation = stats.count > 0 ? stats.total / stats.count : 0;

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold flex items-center gap-2">
                <Heart className="h-8 w-8 text-rose-500 fill-rose-500" />
                Doações Recebidas
            </h1>
            <p className="text-muted-foreground">
                Acompanhe a solidariedade dos seus clientes (baseado nos pagamentos confirmados).
            </p>
        </div>

        <div className="flex items-center gap-3">
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => refetch()} 
                className={isRefetching ? "animate-spin" : ""}
            >
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </Button>
            <div className="flex items-center bg-white border border-gray-200 rounded-lg h-10 overflow-hidden shadow-sm">
                <div className="flex items-center px-3 border-r border-gray-200">
                    <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                    <input 
                        type="date" 
                        className="bg-transparent border-none text-xs text-gray-700 focus:outline-none w-24 font-medium font-sans"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div className="flex items-center px-3 bg-white">
                    <span className="text-[10px] uppercase font-bold text-gray-400 mr-2">Até</span>
                    <input 
                        type="date" 
                        className="bg-transparent border-none text-xs text-gray-700 focus:outline-none w-24 font-medium font-sans"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
                {(startDate || endDate) && (
                    <button 
                        onClick={() => { setStartDate(""); setEndDate(""); }}
                        className="h-full px-3 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors border-l border-gray-200"
                        title="Limpar datas"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-rose-500 shadow-sm bg-rose-50/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Total Arrecadado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-rose-600">{formatCurrency(stats.total)}</div>
            <p className="text-xs text-muted-foreground mt-1">Em {stats.count} doações no período</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Doadores Únicos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-800">{uniqueDonors}</div>
            <p className="text-xs text-muted-foreground mt-1">Clientes engajados</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <HandHeart className="h-4 w-4" /> Média por Doação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-800">{formatCurrency(averageDonation)}</div>
            <p className="text-xs text-muted-foreground mt-1">Ticket médio solidário</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-lg">Histórico de Doações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Doador</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead className="text-right">Valor Doado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDonations.length > 0 ? (
                filteredDonations.map((order) => (
                  <TableRow key={order.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar className="h-3 w-3" />
                        {new Date(order.created_at).toLocaleDateString("pt-BR")}
                        <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">
                        {order.profiles ? `${order.profiles.first_name || ''} ${order.profiles.last_name || ''}`.trim() : 'Anônimo'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">#{order.id}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-rose-600">
                      {formatCurrency(order.donation_amount)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">
                    Nenhuma doação encontrada para os critérios selecionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}