"use client";

import React, { memo, useCallback } from "react";
import { Client } from "@/hooks/useClients";
import { TableCell } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { CalendarDays, Eye, Lock, Unlock, MoreHorizontal, Mail, KeyRound, RotateCcw, CheckCircle, Ban, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface Props {
  client: Client;
  onTogglePix: (userId: string, forcePix: boolean) => void;
  toggleLoading?: boolean;
  onOpenDetails: (c: Client) => void;
  onActionConfirm: (action: string, client: Client) => void;
}

function RowComponent({ client, onTogglePix, toggleLoading, onOpenDetails, onActionConfirm }: Props) {
  const handleToggle = useCallback(
    (checked: boolean) => onTogglePix(client.id, checked),
    [client.id, onTogglePix]
  );

  return (
    <>
      <tr>
        <TableCell className="font-medium text-sm">{client.email}</TableCell>
        <TableCell className="text-sm">{client.first_name || "-"} {client.last_name || ""}</TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="w-fit text-xs">Total: {client.order_count} pedido(s)</Badge>
            {client.completed_order_count > 0 ? (
              <Badge className="bg-green-500 hover:bg-green-600 w-fit text-xs">Recorrente ({client.completed_order_count})</Badge>
            ) : (
              <Badge variant="secondary" className="w-fit text-xs">Primeira Compra</Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Switch checked={client.force_pix_on_next_purchase} onCheckedChange={handleToggle} disabled={toggleLoading} />
            <span className={`text-xs font-bold ${client.force_pix_on_next_purchase ? "text-red-600" : "text-green-600"}`}>
              {client.force_pix_on_next_purchase ? "PIX OBRIGATÓRIO" : "CARTÃO LIBERADO"}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="w-3 h-3" />
            {client.created_at ? new Date(client.created_at).toLocaleDateString("pt-BR") : "-"}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" className="text-gray-500 hover:text-blue-600" onClick={() => onOpenDetails(client)} title="Ver Detalhes">
              <Eye className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Ações</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Ações do Usuário</DropdownMenuLabel>

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

                <DropdownMenuItem onSelect={() => onActionConfirm("block_user", client)} className="text-orange-600">
                  <Ban className="mr-2 h-4 w-4" /> Bloquear Usuário
                </DropdownMenuItem>

                <DropdownMenuItem onSelect={() => onActionConfirm("delete_user", client)} className="text-red-700 font-semibold">
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir Usuário
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </tr>
    </>
  );
}

export default memo(RowComponent, (prev, next) => {
  // only re-render if relevant client properties changed
  return (
    prev.client.id === next.client.id &&
    prev.client.force_pix_on_next_purchase === next.client.force_pix_on_next_purchase &&
    prev.client.order_count === next.client.order_count &&
    prev.client.completed_order_count === next.client.completed_order_count &&
    prev.client.email === next.client.email &&
    prev.client.first_name === next.client.first_name &&
    prev.client.last_name === next.client.last_name
  );
});