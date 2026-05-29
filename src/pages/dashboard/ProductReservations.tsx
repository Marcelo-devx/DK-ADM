import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookmarkCheck, Search, RefreshCw, Package, Mail, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ReservationRow {
  id: string;
  user_id: string;
  product_id: number;
  product_name: string;
  product_image: string | null;
  variant_id: string | null;
  variant_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  // joined from profiles
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  active: { label: "Ativa", variant: "default", color: "bg-amber-100 text-amber-700 border-amber-200" },
  cancelled: { label: "Cancelada", variant: "destructive", color: "bg-red-100 text-red-700 border-red-200" },
  fulfilled: { label: "Concluída", variant: "secondary", color: "bg-green-100 text-green-700 border-green-200" },
};

export default function ProductReservations() {
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchReservations = async () => {
    setLoading(true);
    try {
      // 1. Buscar reservas
      const { data: resData, error: resError } = await supabase
        .from("product_reservations")
        .select("id, user_id, product_id, product_name, product_image, variant_id, variant_name, status, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (resError) throw resError;
      if (!resData || resData.length === 0) {
        setReservations([]);
        return;
      }

      // 2. Buscar profiles dos usuários únicos
      const userIds = [...new Set(resData.map((r) => r.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);

      const profileMap = new Map((profilesData ?? []).map((p) => [p.id, p]));

      const rows: ReservationRow[] = resData.map((r) => {
        const profile = profileMap.get(r.user_id);
        return {
          ...r,
          first_name: profile?.first_name ?? null,
          last_name: profile?.last_name ?? null,
          email: profile?.email ?? null,
        };
      });

      setReservations(rows);
    } catch (err: any) {
      toast({
        title: "Erro ao carregar reservas",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, []);

  const filtered = reservations.filter((r) => {
    const fullName = `${r.first_name ?? ""} ${r.last_name ?? ""}`.toLowerCase();
    const matchesSearch =
      r.product_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.variant_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      fullName.includes(search.toLowerCase()) ||
      (r.email ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const counts = {
    total: reservations.length,
    active: reservations.filter((r) => r.status === "active").length,
    fulfilled: reservations.filter((r) => r.status === "fulfilled").length,
    cancelled: reservations.filter((r) => r.status === "cancelled").length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <BookmarkCheck className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Lista de Reservas</h1>
            <p className="text-sm text-slate-500">
              Clientes aguardando produtos voltarem ao estoque · email automático via Resend quando o estoque retornar
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReservations} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{counts.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold">Ativas</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{counts.active}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4">
          <p className="text-xs text-green-600 uppercase tracking-wide font-semibold">Concluídas</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{counts.fulfilled}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4">
          <p className="text-xs text-red-500 uppercase tracking-wide font-semibold">Canceladas</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{counts.cancelled}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por produto, variante, nome ou e-mail do cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="fulfilled">Concluídas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Carregando reservas...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <BookmarkCheck className="w-10 h-10 opacity-30" />
            <p className="text-sm">Nenhuma reserva encontrada</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-14">Img</TableHead>
                <TableHead>Produto / Variante</TableHead>
                <TableHead>
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Cliente</span>
                </TableHead>
                <TableHead>
                  <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> E-mail</span>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reservado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const cfg = statusConfig[r.status] ?? { label: r.status, color: "bg-slate-100 text-slate-600 border-slate-200" };
                const fullName = [r.first_name, r.last_name].filter(Boolean).join(" ") || "—";
                return (
                  <TableRow key={r.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      {r.product_image ? (
                        <img
                          src={r.product_image}
                          alt={r.product_name}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                          <Package className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-slate-800 text-sm">{r.product_name}</p>
                      {r.variant_name ? (
                        <p className="text-xs text-slate-400 mt-0.5">{r.variant_name}</p>
                      ) : (
                        <p className="text-xs text-slate-300 mt-0.5 italic">Sem variante</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-slate-700 font-medium">{fullName}</p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{r.user_id.slice(0, 8)}…</p>
                    </TableCell>
                    <TableCell>
                      {r.email ? (
                        <span className="text-sm text-slate-600">{r.email}</span>
                      ) : (
                        <span className="text-xs text-slate-300 italic">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                      {formatDate(r.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="text-xs text-slate-400 text-right">
          Exibindo {filtered.length} de {reservations.length} reserva(s)
        </p>
      )}
    </div>
  );
}
