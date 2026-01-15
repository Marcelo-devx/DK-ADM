import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Calendar, User } from "lucide-react";

interface ClientImportData {
  email: string;
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  phone: string;
  city: string;
  password?: string;
}

interface ClientImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientsToImport: ClientImportData[];
  onConfirm: () => void;
  isSubmitting: boolean;
}

export const ClientImportModal = ({
  isOpen,
  onClose,
  clientsToImport,
  onConfirm,
  isSubmitting,
}: ClientImportModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-6 w-6" /> Confirmar Importação ({clientsToImport.length} Clientes)
          </DialogTitle>
          <DialogDescription>
            Revise os dados antes de processar. Os campos de gênero e nascimento alimentarão seu Analytics.
          </DialogDescription>
        </DialogHeader>
        
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nome Completo</TableHead>
                <TableHead>Gênero</TableHead>
                <TableHead>Nascimento</TableHead>
                <TableHead>Cidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientsToImport.slice(0, 50).map((client, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium text-xs">{client.email}</TableCell>
                  <TableCell className="text-xs">{client.first_name} {client.last_name}</TableCell>
                  <TableCell className="text-xs">
                    <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-muted-foreground" />
                        {client.gender || 'N/I'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        {client.date_of_birth || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{client.city || '-'}</TableCell>
                </TableRow>
              ))}
              {clientsToImport.length > 50 && (
                <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground italic bg-gray-50/50 py-4">
                        ... e mais {clientsToImport.length - 50} clientes na lista.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end space-x-4 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 font-bold px-8">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              "Confirmar Importação"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};