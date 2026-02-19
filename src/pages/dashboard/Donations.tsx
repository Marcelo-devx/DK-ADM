"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, DollarSign, Users, Calendar, HandHeart, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Donation {
  id: number;
  name_at_purchase: string;
  price_at_purchase: number;
  quantity: number;
  created_at: string;
  orders: {
    id: number;
    status: string;
    user_id: string;
    profiles: {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    } | null;
  } | null;
}

const fetchDonations = async () => {
  // Buscamos itens de pedido que contenham "Doação" no nome
  // E garantimos que o pedido foi PAGO
  const { data, error } = await supabase
    .from("order_items")
    .select(`
      id,
      name_at_purchase,
      price_at_purchase,
      quantity,
      created_at,
      orders!inner (
        id,
        status,
        user_id,
        profiles (
          first_name,
          last_name,
          email
        )
      )
    `)
    .ilike('name_at_purchase', '%Doação%')
    .in('orders.status', ['Pago', 'Finalizada'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as Donation[];
};

export default function DonationsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: donations, isLoading } = useQuery({
    queryKey: ["donations-dashboard"],
    queryFn: fetchDonations,
  });

  const filteredDonations = useMemo(() => {
    if (!donations) return [];
    return donations.filter((item) => {
      if (startDate) {
        const itemDate = new Date(item.created_at);
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Início do dia
        if (itemDate < start) return false;
      }
      if (endDate) {
        const itemDate = new Date(item.created_at);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Final do dia
        if (itemDate > end) return false;
      }
      return true;
    });
  }, [donations, startDate, endDate]);

  const stats = filteredDonations.reduce((acc, item) => {
    const value = item.price_at_purchase * item.quantity;
    acc.total += value;
    acc.count += 1;
    return acc;
  }, { total: 0, count: 0 });

  const uniqueDonors = new Set(filteredDonations.map(d => d.orders?.user_id)).size;
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
            Acompanhe o impacto e a solidariedade dos seus clientes.
            </p>
        </div>

        {/* Filtro de Data */}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-rose-500 shadow-sm bg-rose-50/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Total Arrecadado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-rose-600">{formatCurrency(stats.total)}</div>
            <p className="text-xs text-muted-foreground mt-1">Em {stats.count} doações confirmadas</p>
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
            <p className="text-xs text-muted-foreground mt-1">Clientes engajados no período</p>
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
            <p className="text-xs text-muted-foreground mt-1">Ticket médio de solidariedade</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Doações */}
      <Card className="border-none shadow-md">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-lg">Histórico de Doações</CardTitle>
          <CardDescription>Lista das doações mais recentes realizadas no checkout.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Doador</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDonations && filteredDonations.length > 0 ? (
                filteredDonations.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar className="h-3 w-3" />
                        {new Date(item.created_at).toLocaleDateString("pt-BR")}
                        <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {item.orders?.profiles?.first_name || 'Anônimo'} {item.orders?.profiles?.last_name || ''}
                      </div>
                      <div className="text-xs text-muted-foreground">{item.orders?.profiles?.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">#{item.orders?.id}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-rose-600">
                      {formatCurrency(item.price_at_purchase * item.quantity)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                    Nenhuma doação encontrada para o período selecionado.
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