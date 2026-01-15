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
import { Loader2, Users } from "lucide-react";

interface ClientImportData {
  email: string;
  first_name: string;
  last_name: string;
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-6 w-6" /> Confirmar Importação ({clientsToImport.length} Clientes)
          </DialogTitle>
          <DialogDescription>
            Revise os dados abaixo. Se a senha não for fornecida, será definida como <strong>123456</strong>.
            <br />
            <span className="text-red-500 font-bold text-xs">Atenção: Usuários com e-mails já cadastrados serão ignorados.</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Sobrenome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Senha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientsToImport.slice(0, 100).map((client, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{client.email}</TableCell>
                  <TableCell>{client.first_name}</TableCell>
                  <TableCell>{client.last_name}</TableCell>
                  <TableCell>{client.phone || '-'}</TableCell>
                  <TableCell>{client.city || '-'}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {client.password ? 'Definida' : 'Padrão (123456)'}
                  </TableCell>
                </TableRow>
              ))}
              {clientsToImport.length > 100 && (
                <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground italic">
                        ... e mais {clientsToImport.length - 100} clientes.
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
          <Button onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
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