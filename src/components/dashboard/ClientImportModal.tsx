import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Users, CheckCircle2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ClientImportData {
  email: string;
  full_name: string;
  date_of_birth: string | null;
  phone: string;
  city: string;
  state?: string;
  cpf_cnpj?: string;
  password?: string;
  [key: string]: any;
}

interface ClientImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientsToImport: ClientImportData[];
  onConfirm: () => void;
  isSubmitting: boolean;
}

export const ClientImportModal = ({
  isOpen, onClose, clientsToImport, onConfirm, isSubmitting,
}: ClientImportModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 shrink-0" />
            Validar Importação ({clientsToImport.length} Registros)
          </DialogTitle>
          <DialogDescription>
            Revise os dados abaixo antes de confirmar o processamento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 px-1 space-y-4">
          {/* Regras */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-3">
              <div className="bg-green-100 p-2 rounded-full text-green-700 mt-0.5 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-green-800 text-sm">Novos Clientes</h4>
                <p className="text-xs text-green-700 mt-1">
                  Se o e-mail não existir, um novo cadastro será criado com senha padrão (123456) caso não informada.
                </p>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
              <div className="bg-blue-100 p-2 rounded-full text-blue-700 mt-0.5 shrink-0">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-blue-800 text-sm">Clientes Existentes</h4>
                <p className="text-xs text-blue-700 mt-1">
                  Se o e-mail já existir, <strong>atualizaremos apenas os campos preenchidos</strong>. Dados antigos não serão apagados se a célula estiver vazia.
                </p>
              </div>
            </div>
          </div>

          {/* ── Mobile: cards ── */}
          <div className="md:hidden space-y-2">
            {clientsToImport.slice(0, 100).map((client, index) => (
              <div key={index} className="bg-white rounded-xl border p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-sm text-blue-700 truncate flex-1">{client.email}</p>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {client.password ? "Senha própria" : "Padrão"}
                  </Badge>
                </div>
                <p className="text-sm font-medium text-gray-800">{client.full_name || <span className="text-gray-300 italic">Sem nome</span>}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  {client.cpf_cnpj && <span>CPF: {client.cpf_cnpj}</span>}
                  {client.phone && <span>Tel: {client.phone}</span>}
                  {client.city && <span>{client.city}{client.state ? `/${client.state}` : ""}</span>}
                </div>
              </div>
            ))}
            {clientsToImport.length > 100 && (
              <p className="text-center text-xs text-muted-foreground italic py-2">
                ... e mais {clientsToImport.length - 100} registros ocultos para performance.
              </p>
            )}
          </div>

          {/* ── Desktop: tabela ── */}
          <div className="hidden md:block border rounded-lg overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-gray-50 sticky top-0">
                <TableRow>
                  <TableHead>Email (Chave)</TableHead>
                  <TableHead>Nome Completo</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Senha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientsToImport.slice(0, 100).map((client, index) => (
                  <TableRow key={index} className="hover:bg-gray-50">
                    <TableCell className="font-medium text-xs">{client.email}</TableCell>
                    <TableCell className="text-xs">{client.full_name || <span className="text-gray-300 italic">Vazio</span>}</TableCell>
                    <TableCell className="text-xs">{client.cpf_cnpj || <span className="text-gray-300 italic">Vazio</span>}</TableCell>
                    <TableCell className="text-xs">{client.phone || <span className="text-gray-300 italic">Vazio</span>}</TableCell>
                    <TableCell className="text-xs">
                      {client.city ? `${client.city}/${client.state || ""}` : <span className="text-gray-300 italic">Vazio</span>}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">
                      {client.password ? "Personalizada" : "Padrão (123456)"}
                    </TableCell>
                  </TableRow>
                ))}
                {clientsToImport.length > 100 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground italic bg-gray-50">
                      ... e mais {clientsToImport.length - 100} registros ocultos para performance.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t bg-white">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isSubmitting} className="bg-black hover:bg-gray-800 font-bold px-6 w-full sm:w-auto">
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</>
            ) : (
              "Confirmar e Processar"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
