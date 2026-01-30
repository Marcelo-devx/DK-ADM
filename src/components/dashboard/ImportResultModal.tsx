import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, XCircle, RefreshCw, PlusCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImportResult {
  created?: number; // Opcional para retrocompatibilidade
  updated?: number; // Opcional
  success: number; // Total (created + updated) ou legado
  failed: number;
  errors: string[];
}

interface ImportResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ImportResult | null;
}

export const ImportResultModal = ({
  isOpen,
  onClose,
  result,
}: ImportResultModalProps) => {
  if (!result) return null;

  // Fallback se a API antiga retornar apenas 'success' sem detalhar created/updated
  const createdCount = result.created ?? result.success;
  const updatedCount = result.updated ?? 0;
  // Se tivermos os detalhes, o total de sucesso é a soma, senão usamos o campo success legado
  const totalSuccess = (result.created !== undefined && result.updated !== undefined) 
    ? result.created + result.updated 
    : result.success;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Relatório de Processamento
          </DialogTitle>
          <DialogDescription>
            Confira o resultado da importação inteligente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Cards de Resumo */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 p-3 rounded-xl border border-green-100 flex flex-col items-center justify-center text-center shadow-sm">
              <PlusCircle className="w-6 h-6 text-green-600 mb-1" />
              <span className="text-2xl font-black text-green-700">{createdCount}</span>
              <span className="text-[9px] text-green-600 font-bold uppercase tracking-wider">Novos</span>
            </div>
            
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex flex-col items-center justify-center text-center shadow-sm">
              <RefreshCw className="w-6 h-6 text-blue-600 mb-1" />
              <span className="text-2xl font-black text-blue-700">{updatedCount}</span>
              <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wider">Atualizados</span>
            </div>

            <div className="bg-red-50 p-3 rounded-xl border border-red-100 flex flex-col items-center justify-center text-center shadow-sm">
              <XCircle className="w-6 h-6 text-red-600 mb-1" />
              <span className="text-2xl font-black text-red-700">{result.failed}</span>
              <span className="text-[9px] text-red-600 font-bold uppercase tracking-wider">Falhas</span>
            </div>
          </div>

          {/* Lista de Erros */}
          {result.errors && result.errors.length > 0 ? (
            <div className="border rounded-lg bg-gray-50 overflow-hidden shadow-sm">
              <div className="p-3 border-b bg-gray-100 text-xs font-bold text-gray-600 uppercase flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" /> Detalhes das Falhas ({result.errors.length})
              </div>
              <ScrollArea className="h-[200px] p-0 w-full">
                <div className="divide-y divide-gray-200">
                  {result.errors.map((error, index) => (
                    <div key={index} className="p-3 text-xs flex gap-2 items-start hover:bg-white transition-colors">
                      <span className="font-mono text-red-500 font-bold select-none">{index + 1}.</span>
                      <span className="text-gray-700 leading-relaxed break-words w-full">{error}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 bg-green-50/50 rounded-lg border border-dashed border-green-200 text-green-800">
                <CheckCircle2 className="w-6 h-6 mb-2 text-green-600" />
                <p className="text-sm font-medium">Sucesso Total! Nenhum erro encontrado.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full bg-gray-900 hover:bg-gray-800 font-bold">
            Fechar Relatório
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};