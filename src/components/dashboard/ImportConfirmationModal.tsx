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
import { Loader2, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProductImportData {
  name: string;
  description: string | null;
  price: number;
  pix_price: number | null;
  stock_quantity: number;
  category: string | null;
  sub_category: string | null;
  brand: string | null;
  image_url: string | null;
  is_visible: boolean;
}

interface ImportConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  productsToImport: ProductImportData[];
  onConfirm: () => void;
  isSubmitting: boolean;
}

export const ImportConfirmationModal = ({
  isOpen,
  onClose,
  productsToImport,
  onConfirm,
  isSubmitting,
}: ImportConfirmationModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-6 w-6" /> Confirmar Importação ({productsToImport.length} Produtos)
          </DialogTitle>
          <DialogDescription>
            Revise os produtos abaixo. Eles serão adicionados ou atualizados no seu catálogo após a confirmação.
          </DialogDescription>
        </DialogHeader>
        
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead className="text-green-600">Pix</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Visível</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsToImport.map((product, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium max-w-[200px] truncate">{product.name}</TableCell>
                  <TableCell>
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(product.price)}
                  </TableCell>
                  <TableCell className="font-bold text-green-700">
                    {product.pix_price ? new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(product.pix_price) : '-'}
                  </TableCell>
                  <TableCell>{product.stock_quantity}</TableCell>
                  <TableCell>{product.category || '-'}</TableCell>
                  <TableCell>{product.brand || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={product.is_visible ? "default" : "outline"}>
                      {product.is_visible ? "Sim" : "Não"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
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
                Processando Planilha...
              </>
            ) : (
              "Confirmar e Processar"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};