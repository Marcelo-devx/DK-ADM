"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, DollarSign, Users, Calendar, HandHeart, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DonationOrder {
  id: number; donation_amount: number; created_at: string; status: string;
  user_id: string | null; first_name: string | null; last_name: string | null; email: string | null;
}

const fetchDonations = async (): Promise<DonationOrder[]> => {
  const { data, error } = await supabase.rpc("get_donations_report");
  if (error) throw error;
  return (data ?? []) as DonationOrder[];
};

export default function DonationsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: donations, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["donations-list-v5"],
    queryFn: fetchDonations,
  });

  const filteredDonations = useMemo(() => {
    if (!donations) return [];
    const term = searchTerm.trim().toLowerCase();
    return donations.filter((order) => {
      const orderDate = new Date(order.created_at);
      if (startDate) { const s = new Date(startDate); s.setHours(0,0,0,0); if (orderDate < s) return false; }
      if (endDate) { const e = new Date(endDate); e.setHours(23,59,59,999); if (orderDate > e) return false; }
      if (!term) return true;
      const fullName = `${order.first_name || ""} ${order.last_name || ""}`.toLowerCase();
      return String(order.id).includes(term) || fullName.includes(term) || (order.email || "").toLowerCase().includes(term);
    });
  }, [donations, startDate, endDate, searchTerm]);

  const stats = useMemo(() => filteredDonations.reduce((acc, o) => { acc.total += Number(o.donation_amount || 0); acc.count += 1; return acc; }, { total: 0, count: 0 }), [filteredDonations]);
  const uniqueDonors = useMemo(() => new Set(filteredDonations.map((d) => d.user_id).filter(Boolean)).size, [filteredDonations]);
  const averageDonation = stats.count > 0 ? stats.total / stats.count : 0;
  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Heart className="h-7 w-7 text-rose-500 fill-rose-500 shrink-0" /> Doações Recebidas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe a solidariedade dos seus clientes.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => refetch()} className={isRefetching ? "animate-spin" : ""}>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </Button>
          {/* Filtro de datas */}
          <div className="flex items-center bg-white border rounded-lg h-10 overflow-hidden shadow-sm text-xs">
            <div className="flex items-center px-2 border-r">
              <Calendar className="w-3.5 h-3.5 text-gray-400 mr-1.5" />
              <input type="date" className="bg-transparent border-none text-gray-700 focus:outline-none w-24 font-medium" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="flex items-center px-2">
              <span className="text-[10px] uppercase font-bold text-gray-400 mr-1.5">Até</span>
              <input type="date" className="bg-transparent border-none text-gray-700 focus:outline-none w-24 font-medium" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            {(startDate || endDate) && (
              <button onClick={() => { setStartDate(""); setEndDate(""); }} className="h-full px-2 hover:bg-red-50 text-gray-400 hover:text-red-500 border-l">✕</button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-rose-500 bg-rose-50/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" />Total Arrecadado</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-rose-600">{formatCurrency(stats.total)}</div><p className="text-xs text-muted-foreground mt-1">Em {stats.count} doações</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" />Doadores Únicos</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-slate-800">{uniqueDonors}</div><p className="text-xs text-muted-foreground mt-1">Clientes engajados</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><HandHeart className="h-4 w-4" />Média por Doação</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-slate-800">{formatCurrency(averageDonation)}</div><p className="text-xs text-muted-foreground mt-1">Ticket médio solidário</p></CardContent>
        </Card>
      </div>

      {/* Histórico */}
      <Card className="border-none shadow-md">
        <CardHeader className="bg-slate-50 border-b flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Histórico de Doações</CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Buscar por ID, nome ou e-mail" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent className="p-0">

          {/* ── Mobile: cards ── */}
          <div className="md:hidden divide-y">
            {filteredDonations.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground italic px-4">Nenhuma doação encontrada.</p>
            ) : (
              filteredDonations.map((order) => (
                <div key={order.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm">{`${order.first_name || ""} ${order.last_name || ""}`.trim() || "Anônimo"}</p>
                      {order.email && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{order.email}</p>}
                    </div>
                    <span className="text-lg font-black text-rose-600 shrink-0">{formatCurrency(order.donation_amount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(order.created_at).toLocaleDateString("pt-BR")} {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px]">#{order.id}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Desktop: tabela ── */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead><TableHead>Doador</TableHead><TableHead>E-mail</TableHead>
                  <TableHead>Pedido</TableHead><TableHead className="text-right">Valor Doado</TableHead>
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
                          <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </TableCell>
                      <TableCell><div className="font-medium text-sm">{`${order.first_name || ""} ${order.last_name || ""}`.trim() || "Anônimo"}</div></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{order.email || <span className="italic text-gray-300">—</span>}</TableCell>
                      <TableCell><Badge variant="outline" className="font-mono text-[10px]">#{order.id}</Badge></TableCell>
                      <TableCell className="text-right font-bold text-rose-600">{formatCurrency(order.donation_amount)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">Nenhuma doação encontrada para os critérios selecionados.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
