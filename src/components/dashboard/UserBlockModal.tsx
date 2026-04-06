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
import { Loader2 } from "lucide-react";

interface UserBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  isBlocking: boolean;
  onConfirm: (reason: string) => Promise<void>;
}

export function UserBlockModal({ isOpen, onClose, user, isBlocking, onConfirm }: UserBlockModalProps) {
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isBlocking ? "Bloquear Usuário" : "Desbloquear Usuário"}
          </DialogTitle>
          <DialogDescription>
            {isBlocking ? (
              <>
                Você está bloqueando o acesso de{" "}
                <span className="font-bold">{user?.first_name} {user?.last_name}</span>.
                O usuário não conseguirá fazer login no sistema.
              </>
            ) : (
              <>
                Você está desbloqueando o acesso de{" "}
                <span className="font-bold">{user?.first_name} {user?.last_name}</span>.
                O usuário poderá fazer login novamente.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">
              Motivo {isBlocking ? "do bloqueio" : "do desbloqueio"} <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Descreva o motivo desta ação..."
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
            disabled={!reason.trim() || isSubmitting}
            variant={isBlocking ? "destructive" : "default"}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isBlocking ? "Bloqueando..." : "Desbloqueando..."}
              </>
            ) : (
              isBlocking ? "Confirmar Bloqueio" : "Confirmar Desbloqueio"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
