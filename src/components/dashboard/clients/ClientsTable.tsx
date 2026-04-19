"use client";

import React, { useCallback } from "react";
import { Client } from "@/hooks/useClients";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ClientRow from "@/components/dashboard/clients/ClientRow";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Eye, MoreHorizontal, Fingerprint, Mail, CalendarDays,
  Lock, Unlock, CheckCircle, RotateCcw, KeyRound, Users,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Props {
  clients: Client[];
  isLoading: boolean;
  toggleLoading?: boolean;
  onTogglePix: (userId: string, forcePix: boolean) => void;
  onOpenDetails: (c: Client) => void;
  onActionConfirm: (action: string, client: Client) => void;
}

const formatCPF = (cpf: string | null) => {
  if (!cpf) return "-";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (clean.length === 14) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return cpf;
};

export default function ClientsTable({ clients, isLoading, toggleLoading, onTogglePix, onOpenDetails, onActionConfirm }: Props) {
  return (
    <div>
      {/* ── Mobile: cards ── */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-4 animate-pulse h-28" />
          ))
        ) : clients.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p>Nenhum cliente encontrado.</p>
          </div>
        ) : (
          clients.map((client) => (
            <div
              key={client.id}
              className="bg-white rounded-xl border-2 border-gray-100 shadow-sm p-4 space-y-3"
            >
              {/* Nome + ações */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base text-gray-900 leading-tight">
                    {client.first_name || "-"} {client.last_name || ""}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => onOpenDetails(client)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={() => onTogglePix(client.id, !client.force_pix_on_next_purchase)} disabled={toggleLoading} className={client.force_pix_on_next_purchase ? "text-green-600" : "text-red-600"}>
                        {client.force_pix_on_next_purchase ? <><Unlock className="h-4 w-4 mr-2" /> Liberar Cartão</> : <><Lock className="h-4 w-4 mr-2" /> Exigir PIX</>}
                      </DropdownMenuItem>
                      {client.completed_order_count === 0 && (
                        <DropdownMenuItem onSelect={() => onActionConfirm("mark_as_recurrent", client)}>
                          <CheckCircle className="mr-2 h-4 w-4" /> Marcar como Recorrente
                        </DropdownMenuItem>
                      )}
                      {client.order_count > 0 && (
                        <DropdownMenuItem onSelect={() => onActionConfirm("delete_orders", client)} className="text-red-600">
                          <RotateCcw className="mr-2 h-4 w-4" /> Redefinir Status Compra
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => onActionConfirm("resend_confirmation", client)}>
                        <Mail className="mr-2 h-4 w-4" /> Reenviar Confirmação
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onActionConfirm("send_password_reset", client)}>
                        <KeyRound className="mr-2 h-4 w-4" /> Redefinir Senha
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* CPF + data */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Fingerprint className="w-3 h-3" />
                  <span className="font-mono">{formatCPF(client.cpf_cnpj)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  {client.created_at ? new Date(client.created_at).toLocaleDateString("pt-BR") : "-"}
                </div>
              </div>

              {/* Badges de status */}
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant="outline" className="text-xs">
                  {client.order_count} pedido(s)
                </Badge>
                {client.completed_order_count > 0 ? (
                  <Badge className="bg-green-500 hover:bg-green-600 text-xs">
                    Recorrente ({client.completed_order_count})
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Primeira Compra</Badge>
                )}
              </div>

              {/* PIX switch */}
              <div className={cn(
                "flex items-center justify-between p-2.5 rounded-lg border",
                client.force_pix_on_next_purchase ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
              )}>
                <span className={cn("text-xs font-bold", client.force_pix_on_next_purchase ? "text-red-700" : "text-green-700")}>
                  {client.force_pix_on_next_purchase ? "🔒 PIX Obrigatório" : "✅ Cartão Liberado"}
                </span>
                <Switch
                  checked={client.force_pix_on_next_purchase}
                  onCheckedChange={(v) => onTogglePix(client.id, v)}
                  disabled={toggleLoading}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Desktop: tabela ── */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-primary font-bold">CPF/CNPJ</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Status Compra</TableHead>
              <TableHead>Segurança (Exigir PIX)</TableHead>
              <TableHead>Cliente Desde</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell>
                </TableRow>
              ))
            ) : clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              clients.map((c) => (
                <ClientRow
                  key={c.id}
                  client={c}
                  onTogglePix={onTogglePix}
                  toggleLoading={toggleLoading}
                  onOpenDetails={onOpenDetails}
                  onActionConfirm={onActionConfirm}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
