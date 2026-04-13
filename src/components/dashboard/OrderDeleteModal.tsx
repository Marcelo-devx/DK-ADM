import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Loader2, AlertTriangle, Ban } from "lucide-react";

interface OrderDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onConfirm: (reason: string) => Promise<void>;
}

export function OrderDeleteModal({ isOpen, onClose, order, onConfirm }: OrderDeleteModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCancelled = order?.status === "Cancelado";

  const handleSubmit = async () => {
    if (!reason.trim() || !isCancelled) return;
    setIsSubmitting(true);
    try {
      await onConfirm(reason);
      setReason("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Excluir Pedido
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Você está prestes a excluir permanentemente o pedido{" "}
              <span className="font-bold">#{order?.id}</span>.
            </p>
            <p className="text-red-600 font-medium">
              Esta ação é irreversível!
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-slate-50 p-4 rounded-lg space-y-2">
            <p className="text-sm"><strong>Cliente:</strong> {order?.profiles?.first_name} {order?.profiles?.last_name}</p>
            <p className="text-sm">
              <strong>Status:</strong>{" "}
              <span className={isCancelled ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>
                {order?.status}
              </span>
            </p>
            <p className="text-sm"><strong>Total:</strong> {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(Number(order?.total_price))}</p>
          </div>

          {/* Bloqueio: pedido não cancelado */}
          {!isCancelled && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex gap-3">
              <Ban className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-red-700">
                  Não é possível excluir este pedido
                </p>
                <p className="text-sm text-red-600">
                  O pedido precisa estar com status <strong>Cancelado</strong> antes de ser excluído.
                  Isso garante que o estoque dos produtos seja devolvido corretamente.
                </p>
                <p className="text-sm text-red-600 mt-1">
                  <strong>Como proceder:</strong> Cancele o pedido primeiro e depois exclua.
                </p>
              </div>
            </div>
          )}

          {/* Formulário: só exibe se cancelado */}
          {isCancelled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="reason">
                  Motivo da exclusão <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="reason"
                  placeholder="Descreva o motivo desta exclusão..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Observação:</strong> O estoque já foi devolvido quando o pedido foi cancelado. Esta ação apenas remove o registro do sistema.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {isCancelled ? "Cancelar" : "Fechar"}
          </Button>
          {isCancelled && (
            <Button
              onClick={handleSubmit}
              disabled={!reason.trim() || isSubmitting}
              variant="destructive"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Sim, Excluir Pedido"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
