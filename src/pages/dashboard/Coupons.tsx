"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { CouponForm } from "@/components/dashboard/coupon-form";
import { showSuccess, showError } from "@/utils/toast";
import { PlusCircle, MoreHorizontal, Ticket } from "lucide-react";
import { Switch } from "@/components/ui/switch";

type Coupon = {
  id: number;
  name: string;
  description: string | null;
  discount_value: number;
  points_cost: number;
  minimum_order_value: number;
  stock_quantity: number;
  is_active: boolean;
};

const fetchCoupons = async () => {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
};

const CouponsPage = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);

  const { data: coupons, isLoading: isLoadingCoupons } = useQuery<Coupon[]>({
    queryKey: ["coupons"],
    queryFn: fetchCoupons,
  });

  const upsertMutation = useMutation({
    mutationFn: async (values: Omit<Coupon, 'id'> & { id?: number }) => {
      const { error } = await supabase.from('coupons').upsert(values);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      setIsModalOpen(false);
      setSelectedCoupon(null);
      showSuccess("Cupom salvo com sucesso!");
    },
    onError: (error: Error) => {
      showError(`Erro ao salvar cupom: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (couponId: number) => {
      const { error } = await supabase.from("coupons").delete().eq("id", couponId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      setIsDeleteAlertOpen(false);
      showSuccess("Cupom removido com sucesso!");
    },
    onError: (error: Error) => {
      showError(`Erro ao remover cupom: ${error.message}`);
    },
  });

  const handleFormSubmit = (values: any) => {
    upsertMutation.mutate(values);
  };

  const handleDeleteConfirm = () => {
    if (!selectedCoupon) return;
    deleteMutation.mutate(selectedCoupon.id);
  };

  const handleStatusChange = (coupon: Coupon, newStatus: boolean) => {
    upsertMutation.mutate({ ...coupon, is_active: newStatus });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Ticket /> Cupons de Desconto</h1>
        <Dialog
          open={isModalOpen}
          onOpenChange={(isOpen) => {
            setIsModalOpen(isOpen);
            if (!isOpen) setSelectedCoupon(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Adicionar Cupom
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {selectedCoupon ? "Editar Cupom" : "Adicionar Novo Cupom"}
              </DialogTitle>
            </DialogHeader>
            <CouponForm
              onSubmit={handleFormSubmit}
              isSubmitting={upsertMutation.isPending}
              initialData={selectedCoupon || undefined}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Condição de Uso</TableHead>
              <TableHead>Desconto</TableHead>
              <TableHead>Custo (Pontos)</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingCoupons ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  Carregando cupons...
                </TableCell>
              </TableRow>
            ) : coupons && coupons.length > 0 ? (
              coupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell className="font-medium">{coupon.name}</TableCell>
                  <TableCell>
                    <p className="max-w-[200px] truncate" title={coupon.description || ''}>
                      {coupon.description || "-"}
                    </p>
                  </TableCell>
                  <TableCell>
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(coupon.discount_value)}
                  </TableCell>
                  <TableCell>{coupon.points_cost}</TableCell>
                  <TableCell>{coupon.stock_quantity}</TableCell>
                  <TableCell>
                    <Switch
                      checked={coupon.is_active}
                      onCheckedChange={(newStatus) => handleStatusChange(coupon, newStatus)}
                      disabled={upsertMutation.isPending}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem
                          onSelect={() => {
                            setSelectedCoupon(coupon);
                            setIsModalOpen(true);
                          }}
                        >
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onSelect={() => {
                            setSelectedCoupon(coupon);
                            setIsDeleteAlertOpen(true);
                          }}
                        >
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  Nenhum cupom encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso removerá permanentemente o cupom.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CouponsPage;