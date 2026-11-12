import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Gift, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PromotionDay {
  promotion_date: string;
  created_at: string;
}

const formatDate = (date: string) => date.split("-").reverse().join("/");

export default function DoublePoints() {
  const { isAdmin, loading } = useUser();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState("");
  const [cancelDate, setCancelDate] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const today = ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-");
  const tomorrow = new Date(new Date(`${today}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);

  const { data: days = [], isLoading, error, refetch } = useQuery({
    queryKey: ["doublePointsDays"],
    enabled: !loading && isAdmin,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("loyalty_double_points_days")
        .select("promotion_date, created_at").order("promotion_date", { ascending: false });
      if (error) throw error;
      return data as PromotionDay[];
    },
  });

  const schedule = useMutation({
    retry: false,
    mutationFn: async (date: string) => {
      if (!date || date <= today) throw new Error("Escolha uma data a partir de amanhã.");
      const { error } = await supabase.from("loyalty_double_points_days").insert({ promotion_date: date });
      if (error?.code === "23505") throw new Error("Essa data já está agendada para pontos em dobro.");
      if (error?.code === "42501") throw new Error("Não foi possível agendar. Verifique seu acesso de administrador e escolha uma data futura.");
      if (error) throw error;
    },
    onSuccess: (_, date) => {
      showSuccess(`Pontos em dobro agendados para ${formatDate(date)}!`);
      setSelectedDate("");
      queryClient.invalidateQueries({ queryKey: ["doublePointsDays"] });
    },
    onError: (error: Error) => showError(error.message),
  });

  const cancel = useMutation({
    retry: false,
    mutationFn: async (date: string) => {
      const { data, error } = await supabase.from("loyalty_double_points_days")
        .delete().eq("promotion_date", date).select("promotion_date");
      if (error) throw error;
      if (!data?.length) throw new Error("Só é possível cancelar uma promoção antes do dia agendado. Atualize a lista.");
    },
    onSuccess: () => {
      showSuccess("Agendamento cancelado.");
      setCancelDate(null);
      queryClient.invalidateQueries({ queryKey: ["doublePointsDays"] });
    },
    onError: (error: Error) => showError(error.message),
  });

  if (loading) return <p>Carregando...</p>;
  if (!isAdmin) return <Navigate to="/dashboard/orders" replace />;

  const activeToday = days.some(day => day.promotion_date === today);
  const alreadyScheduled = days.some(day => day.promotion_date === selectedDate);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold md:text-3xl">
          <Gift className="h-8 w-8 text-amber-600" /> Pontos em dobro
        </h1>
        <p className="mt-2 text-muted-foreground">Escolha o dia em que as vendas receberão o dobro de pontos do Club DK.</p>
      </div>

      {!error && !isLoading && (
        <Alert className={activeToday ? "border-amber-300 bg-amber-50" : "bg-white"}>
          <Gift className="h-4 w-4" />
          <AlertTitle>{activeToday ? "Pontos em dobro ativos hoje!" : "Hoje a pontuação está normal"}</AlertTitle>
          <AlertDescription>
            {activeToday
              ? `As compras confirmadas hoje, ${formatDate(today)}, recebem 2x os pontos da compra. A promoção termina à meia-noite.`
              : "As promoções começam e terminam automaticamente, somente nas datas agendadas."}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Agendar um dia de pontos em dobro</CardTitle>
          <CardDescription>O agendamento vale das 00h até o fim do dia escolhido, no horário de Brasília.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={event => {
            event.preventDefault();
            schedule.mutate(selectedDate);
          }}>
            <div className="flex-1 space-y-2">
              <Label htmlFor="promotion-date">Data da promoção</Label>
              <Input id="promotion-date" type="date" min={tomorrow} required value={selectedDate}
                disabled={schedule.isPending} onChange={event => setSelectedDate(event.target.value)} />
              <p className="text-xs text-muted-foreground">Selecione uma data a partir de amanhã. Não altera compras anteriores.</p>
            </div>
            <Button type="submit" disabled={!selectedDate || selectedDate <= today || alreadyScheduled || schedule.isPending || isLoading || !!error}>
              {schedule.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-2 h-4 w-4" />}
              Salvar agendamento
            </Button>
          </form>
          {alreadyScheduled && <p className="mt-3 text-sm text-amber-700">Essa data já está agendada.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datas agendadas</CardTitle>
          <CardDescription>Você pode cancelar uma promoção antes do dia escolhido. Os dias encerrados ficam no histórico.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando agendamentos...</p>
          ) : error ? (
            <div className="space-y-3" role="alert">
              <p className="text-destructive">Não foi possível carregar os agendamentos.</p>
              <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
            </div>
          ) : days.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">Nenhuma data agendada. Escolha um dia acima para começar.</p>
          ) : (
            <ul className="divide-y">
              {days.map(day => {
                const date = day.promotion_date;
                const future = date > today;
                return (
                  <li key={date} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-5 w-5 text-amber-600" />
                      <div>
                        <p className="font-semibold">{formatDate(date)}</p>
                        <p className="text-xs text-muted-foreground">2x pontos da compra · Dia inteiro · Brasília</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={date === today ? "default" : "secondary"}>
                        {future ? "Agendada" : date === today ? "Ativa hoje" : "Encerrada"}
                      </Badge>
                      {future && <Button variant="ghost" size="sm" disabled={cancel.isPending} onClick={() => setCancelDate(date)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Cancelar
                      </Button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Alert>
        <CalendarDays className="h-4 w-4" />
        <AlertTitle>Como funciona</AlertTitle>
        <AlertDescription>
          O dia considerado é o da confirmação do pagamento (pedido Pago ou Finalizada), não o da entrega.
          Os pontos continuam sendo liberados quando o pedido é marcado como Entregue, mesmo que isso aconteça depois da promoção.
          O dobro é aplicado aos pontos da compra, incluindo o multiplicador do nível do cliente.
          Bônus de indicação, aniversário e outros bônus separados não são dobrados.
          Pedidos configurados para não gerar pontos continuam sem pontuar.
        </AlertDescription>
      </Alert>

      <AlertDialog open={!!cancelDate} onOpenChange={open => { if (!open && !cancel.isPending) setCancelDate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pontos em dobro?</AlertDialogTitle>
            <AlertDialogDescription>As vendas de {cancelDate ? formatDate(cancelDate) : ""} terão pontuação normal.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancel.isPending}>Manter agendamento</AlertDialogCancel>
            <AlertDialogAction disabled={cancel.isPending} onClick={event => {
              event.preventDefault();
              if (cancelDate) cancel.mutate(cancelDate);
            }}>
              {cancel.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
