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
import { Loader2, AlertTriangle } from "lucide-react";

interface OrderDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onConfirm: (reason: string) => Promise<void>;
}

export function OrderDeleteModal({ isOpen, onClose, order, onConfirm }: OrderDeleteModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      return;
    }
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
            <p className="text-sm"><strong>Status:</strong> {order?.status}</p>
            <p className="text-sm"><strong>Total:</strong> {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(Number(order?.total_price))}</p>
          </div>
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
              <strong>Observação:</strong> O estoque será devolvido automaticamente e o histórico de alterações será mantido para auditoria.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
