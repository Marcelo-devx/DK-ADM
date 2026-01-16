import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Users, Send, MessageSquare, Text, Sparkles } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

interface RetentionCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RetentionCampaignModal = ({ isOpen, onClose }: RetentionCampaignModalProps) => {
  const queryClient = useQueryClient();
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string>("Oi {{name}}! Sentimos sua falta na Tabacaria. Chegaram muitas novidades que combinam com você. Vem conferir! 🚀");

  // 1. Buscar Clientes em Risco
  const { data: atRiskClients, isLoading: isLoadingClients } = useQuery({
    queryKey: ["customersAtRisk"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_customers_at_risk");
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  // 2. Verificar se há Webhook configurado
  const { data: hasWebhook } = useQuery({
    queryKey: ["hasRetentionWebhook"],
    queryFn: async () => {
        const { data } = await supabase
            .from('webhook_configs')
            .select('id')
            .eq('trigger_event', 'retention_campaign')
            .eq('is_active', true)
            .maybeSingle();
        return !!data;
    },
    enabled: isOpen
  });

  // 3. Mutação para Enviar Campanha
  const sendCampaignMutation = useMutation({
    mutationFn: async () => {
      if (!message || message.length < 5) throw new Error("Escreva uma mensagem válida.");
      if (selectedUserIds.length === 0) throw new Error("Selecione pelo menos um cliente.");

      const { data, error } = await supabase.functions.invoke("admin-send-campaign", {
        body: {
            userIds: selectedUserIds,
            messageTemplate: message // Envia a mensagem em vez do cupom
        }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      const msg = data.webhooks_fired > 0 
        ? `Mensagens enviadas para processamento de ${selectedUserIds.length} clientes!`
        : `Simulação concluída (${selectedUserIds.length} clientes). Ative o webhook para enviar de verdade.`;
      
      showSuccess(msg);
      setSelectedUserIds([]);
      onClose();
    },
    onError: (error: Error) => {
      showError(`Erro ao enviar campanha: ${error.message}`);
    },
  });

  const handleToggleSelectAll = () => {
    if (!atRiskClients) return;
    if (selectedUserIds.length === atRiskClients.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(atRiskClients.map((c: any) => c.user_id));
    }
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Users className="h-6 w-6 text-blue-600" /> Recuperar Clientes
          </DialogTitle>
          <DialogDescription>
            Envie uma mensagem de reaproximação para clientes inativos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 flex-1 overflow-y-auto px-1">
          {/* Área da Mensagem */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex flex-col gap-3">
            <div className="space-y-2">
                <Label className="text-blue-800 font-bold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Mensagem para WhatsApp
                </Label>
                <Textarea 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)} 
                    className="bg-white min-h-[80px]"
                    placeholder="Escreva sua mensagem aqui..."
                />
                <p className="text-xs text-blue-600 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Dica: Use <strong>{`{{name}}`}</strong> para inserir o primeiro nome do cliente automaticamente.
                </p>
            </div>
            
            {!hasWebhook && (
                <Alert className="bg-yellow-50 border-yellow-200 text-yellow-800 py-2">
                    <AlertDescription className="text-xs flex items-center gap-2">
                        <strong>Atenção:</strong> Nenhum webhook de 'Campanha de Retenção' está ativo. As mensagens não serão disparadas externamente. Vá em Integrações &gt; N8N para configurar.
                    </AlertDescription>
                </Alert>
            )}
          </div>

          {/* Tabela de Clientes */}
          <div className="border rounded-md">
            <Table>
              <TableHeader className="bg-gray-50 sticky top-0">
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <Checkbox
                      checked={
                        atRiskClients &&
                        atRiskClients.length > 0 &&
                        selectedUserIds.length === atRiskClients.length
                      }
                      onCheckedChange={handleToggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-center">Dias Ausente</TableHead>
                  <TableHead className="text-center">Histórico</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingClients ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : atRiskClients && atRiskClients.length > 0 ? (
                  atRiskClients.map((client: any) => (
                    <TableRow key={client.user_id} className={selectedUserIds.includes(client.user_id) ? "bg-blue-50/30" : ""}>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedUserIds.includes(client.user_id)}
                          onCheckedChange={() => handleToggleUser(client.user_id)}
                        />
                      </TableCell>
                      <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{client.customer_name || "Sem Nome"}</span>
                            <span className="text-muted-foreground text-[10px]">{client.email}</span>
                          </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50">
                          {client.days_since_last_order} dias
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {client.total_orders} pedidos
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Parabéns! Nenhum cliente em risco de churn no momento.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white font-bold"
            onClick={() => sendCampaignMutation.mutate()}
            disabled={sendCampaignMutation.isPending || selectedUserIds.length === 0 || !message}
          >
            {sendCampaignMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Disparar Mensagens ({selectedUserIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};