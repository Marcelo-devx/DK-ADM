"use client";

import React from "react";
import { Client } from "@/hooks/useClients";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Calendar, Shield, Ban, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  client: Client;
  onOpenDetails: (c: Client) => void;
  onBlockClient: (c: Client) => void;
  onDeleteClient: (c: Client) => void;
}

export default function ClientPreview({ client, onOpenDetails, onBlockClient, onDeleteClient }: Props) {
  const formatDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "-");

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start gap-6">
        <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-3xl border-4 border-white shadow-sm">
          {client.first_name?.[0]?.toUpperCase() || <User className="w-8 h-8" />}
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{client.first_name} {client.last_name}</h2>
          <div className="flex items-center gap-3 text-sm text-slate-600 mt-2">
            <Mail className="w-4 h-4" /> <span>{client.email}</span>
            <Calendar className="w-4 h-4 ml-4" /> <span>Cliente desde {formatDate(client.created_at)}</span>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 bg-slate-50 rounded border">
              <p className="text-xs text-muted-foreground uppercase">Total Pedidos</p>
              <p className="font-bold">{client.order_count}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded border">
              <p className="text-xs text-muted-foreground uppercase">Finalizados</p>
              <p className="font-bold">{client.completed_order_count}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded border">
              <p className="text-xs text-muted-foreground uppercase">Segurança</p>
              {client.force_pix_on_next_purchase ? (
                <Badge variant="destructive" className="text-sm">PIX OBRIGATÓRIO</Badge>
              ) : (
                <Badge variant="outline" className="text-sm">Cartão Liberado</Badge>
              )}
            </div>
            <div className="p-3 bg-slate-50 rounded border flex items-center justify-center">
              <Button variant="ghost" onClick={() => onOpenDetails(client)}>Ver Detalhes</Button>
            </div>
            {/* Ações de moderação */}
            <div className="p-3 bg-slate-50 rounded border flex flex-col gap-2 items-center justify-center">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-orange-600 border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                onClick={() => onBlockClient(client)}
              >
                <Ban className="w-4 h-4 mr-1" /> Bloquear
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
                onClick={() => onDeleteClient(client)}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Excluir
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
