import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

interface CancelOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
  pendingOrderId: number | null;
}

export const CancelOrderDialog = ({
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
  pendingOrderId,
}: CancelOrderDialogProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Pedido em Aberto Encontrado</AlertDialogTitle>
          <AlertDialogDescription>
            Você já tem o pedido #{pendingOrderId} aguardando pagamento. Para criar um novo pedido, o anterior será cancelado e os itens voltarão para o estoque. Deseja continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={isProcessing}>Voltar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isProcessing}>
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Continuar e Cancelar Pedido Anterior
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};