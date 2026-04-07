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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";

interface UserDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onConfirm: (deleteOrders: boolean, reason: string) => Promise<void>;
}

export function UserDeleteModal({ isOpen, onClose, user, onConfirm }: UserDeleteModalProps) {
  const [reason, setReason] = useState("");
  const [deleteOrders, setDeleteOrders] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(deleteOrders, reason);
      setReason("");
      setDeleteOrders(false);
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
            Excluir Usuário
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Você está prestes a excluir o usuário{" "}
              <span className="font-bold">{user?.first_name} {user?.last_name}</span>.
            </p>
            <p className="text-red-600 font-medium">
              Esta ação é irreversível!
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>O que deseja fazer com os pedidos deste usuário?</Label>
            <RadioGroup value={deleteOrders ? "yes" : "no"} onValueChange={(v) => setDeleteOrders(v === "yes")}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50">
                <RadioGroupItem value="no" id="no" />
                <div className="flex-1">
                  <Label htmlFor="no" className="font-medium cursor-pointer">
                    Excluir apenas o perfil
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Os pedidos serão mantidos mas ficarão anônimos (sem dados do usuário)
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg border-red-200 hover:bg-red-50">
                <RadioGroupItem value="yes" id="yes" className="text-red-600" />
                <div className="flex-1">
                  <Label htmlFor="yes" className="font-medium cursor-pointer text-red-700">
                    Excluir usuário e TODOS os pedidos
                  </Label>
                  <p className="text-xs text-red-600 mt-1">
                    Esta ação removerá permanentemente todos os dados incluindo histórico de pedidos
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">
              Motivo da exclusão (opcional)
            </Label>
            <Textarea
              id="reason"
              placeholder="Descreva o motivo desta exclusão (opcional)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            variant="destructive"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              "Sim, Excluir Usuário"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}