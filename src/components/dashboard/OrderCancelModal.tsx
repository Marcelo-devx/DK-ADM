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
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { Loader2, AlertTriangle, Package } from "lucide-react";

interface OrderCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onConfirm: (reason: string, returnStock: boolean) => Promise<void>;
}

export function OrderCancelModal({ isOpen, onClose, order, onConfirm }: OrderCancelModalProps) {
  const [reason, setReason] = useState("");
  const [returnStock, setReturnStock] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirm(reason, returnStock);
      setReason("");
      setReturnStock(true);
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
            Cancelar Pedido #{order?.id}
          </DialogTitle>
          <DialogDescription>
            Você está prestes a cancelar este pedido. Esta ação é irreversível.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">
              Motivo do cancelamento <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Descreva o motivo do cancelamento..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-3 p-4 bg-slate-50 border rounded-lg">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="returnStock"
                checked={returnStock}
                onCheckedChange={(checked) => setReturnStock(checked as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor="returnStock" className="font-medium cursor-pointer">
                  Devolver estoque ao catálogo
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Os produtos deste pedido serão adicionados novamente ao estoque disponível
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Package className="h-4 w-4 text-red-600 mt-0.5" />
              <div className="text-sm text-red-700">
                <p className="font-medium">Atenção</p>
                <p className="text-xs mt-1">
                  O status do pedido será alterado para "Cancelado" e o histórico será registrado.
                </p>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Voltar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason.trim() || isSubmitting}
            variant="destructive"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelando...
              </>
            ) : (
              "Confirmar Cancelamento"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
