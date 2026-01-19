import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImportResult {
  success: number;
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Relatório de Importação
          </DialogTitle>
          <DialogDescription>
            Confira o resultado do processamento da sua planilha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex flex-col items-center justify-center text-center shadow-sm">
              <CheckCircle2 className="w-8 h-8 text-green-600 mb-2" />
              <span className="text-3xl font-black text-green-700">{result.success}</span>
              <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Importados</span>
            </div>
            <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex flex-col items-center justify-center text-center shadow-sm">
              <XCircle className="w-8 h-8 text-red-600 mb-2" />
              <span className="text-3xl font-black text-red-700">{result.failed}</span>
              <span className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Falhas</span>
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
                <p className="text-sm font-medium">Tudo certo! Nenhum erro encontrado.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full bg-gray-900 hover:bg-gray-800 font-bold">
            Entendi, Fechar Relatório
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};