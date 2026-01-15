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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Ticket, Users, Send } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";

interface RetentionCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RetentionCampaignModal = ({ isOpen, onClose }: RetentionCampaignModalProps) => {
  const queryClient = useQueryClient();
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState<string>("");

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

  // 2. Buscar Cupons Ativos
  const { data: coupons, isLoading: isLoadingCoupons } = useQuery({
    queryKey: ["activeCoupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("id, name, discount_value, description")
        .eq("is_active", true)
        .gt("stock_quantity", 0);
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  // 3. Mutação para Enviar Cupons
  const sendCouponsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCouponId) throw new Error("Selecione um cupom.");
      if (selectedUserIds.length === 0) throw new Error("Selecione pelo menos um cliente.");

      const records = selectedUserIds.map((userId) => ({
        user_id: userId,
        coupon_id: parseInt(selectedCouponId),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Validade de 7 dias para urgência
        is_used: false,
      }));

      const { error } = await supabase.from("user_coupons").insert(records);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess(`Cupom enviado com sucesso para ${selectedUserIds.length} clientes!`);
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

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Users className="h-6 w-6 text-rose-600" /> Campanha de Recuperação
          </DialogTitle>
          <DialogDescription>
            Selecione os clientes inativos e envie um cupom exclusivo para trazê-los de volta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 flex-1 overflow-y-auto px-1">
          {/* Seleção de Cupom */}
          <div className="bg-rose-50 p-4 rounded-lg border border-rose-100 flex flex-col sm:flex-row items-end sm:items-center gap-4">
            <div className="flex-1 w-full space-y-1">
              <Label className="text-rose-800 font-bold flex items-center gap-2">
                <Ticket className="w-4 h-4" /> Escolha o Cupom de Resgate
              </Label>
              <Select value={selectedCouponId} onValueChange={setSelectedCouponId}>
                <SelectTrigger className="bg-white border-rose-200">
                  <SelectValue placeholder={isLoadingCoupons ? "Carregando cupons..." : "Selecione um cupom..."} />
                </SelectTrigger>
                <SelectContent>
                  {coupons?.map((coupon) => (
                    <SelectItem key={coupon.id} value={String(coupon.id)}>
                      <span className="font-bold">{coupon.name}</span> - Desconto de {formatCurrency(coupon.discount_value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedCouponId && (
                <div className="text-xs text-rose-600 max-w-xs">
                    O cupom selecionado será vinculado à conta dos clientes abaixo com validade de <strong>7 dias</strong>.
                </div>
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
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Dias Ausente</TableHead>
                  <TableHead className="text-center">Histórico</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingClients ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : atRiskClients && atRiskClients.length > 0 ? (
                  atRiskClients.map((client: any) => (
                    <TableRow key={client.user_id} className={selectedUserIds.includes(client.user_id) ? "bg-rose-50/30" : ""}>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedUserIds.includes(client.user_id)}
                          onCheckedChange={() => handleToggleUser(client.user_id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{client.customer_name || "Sem Nome"}</TableCell>
                      <TableCell className="text-muted-foreground">{client.email}</TableCell>
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
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Parabéns! Nenhum cliente em risco de churn no momento (mais de 30 dias sem comprar).
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
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            onClick={() => sendCouponsMutation.mutate()}
            disabled={sendCouponsMutation.isPending || selectedUserIds.length === 0 || !selectedCouponId}
          >
            {sendCouponsMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Disparar para {selectedUserIds.length} Cliente(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};