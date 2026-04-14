"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { CouponForm } from "@/components/dashboard/coupon-form";
import { showSuccess, showError } from "@/utils/toast";
import { PlusCircle, MoreHorizontal, Ticket, ShieldCheck, Percent } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useLocation } from "react-router-dom";

type Coupon = {
  id: number;
  name: string;
  description: string | null;
  discount_value: number;
  points_cost: number;
  minimum_order_value: number;
  stock_quantity: number;
  is_active: boolean;
  discount_type?: string;
  is_admin_only?: boolean;
};

const fetchCoupons = async () => {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
};

const formatDiscount = (coupon: Coupon) => {
  if (coupon.discount_type === "shipping") {
    return <span className="font-bold text-green-600">Frete Grátis</span>;
  }
  if (coupon.discount_type === "percentage") {
    return (
      <span className="font-bold text-blue-600 flex items-center gap-1">
        <Percent className="w-3 h-3" />
        {coupon.discount_value}%
      </span>
    );
  }
  return (
    <span className="font-bold text-green-600">
      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(coupon.discount_value)}
    </span>
  );
};

const CouponsPage = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [suggestedData, setSuggestedData] = useState<Partial<Coupon> | null>(null);

  useEffect(() => {
    if (location.state && location.state.suggestedName) {
      setSuggestedData({
        name: location.state.suggestedName,
        description: location.state.suggestedDescription,
        discount_value: 10,
        points_cost: 0,
        minimum_order_value: 0,
        stock_quantity: 100,
        is_active: true,
      } as any);
      setIsModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const { data: coupons, isLoading: isLoadingCoupons } = useQuery<Coupon[]>({
    queryKey: ["coupons"],
    queryFn: fetchCoupons,
  });

  const upsertMutation = useMutation({
    mutationFn: async (values: Omit<Coupon, "id"> & { id?: number }) => {
      const { error } = await supabase.from("coupons").upsert(values);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      setIsModalOpen(false);
      setSelectedCoupon(null);
      setSuggestedData(null);
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
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Ticket /> Cupons de Desconto
        </h1>
        <Dialog
          open={isModalOpen}
          onOpenChange={(isOpen) => {
            setIsModalOpen(isOpen);
            if (!isOpen) {
              setSelectedCoupon(null);
              setSuggestedData(null);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Adicionar Cupom
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedCoupon ? "Editar Cupom" : suggestedData ? "Criar Cupom Sugerido (IA)" : "Adicionar Novo Cupom"}
              </DialogTitle>
            </DialogHeader>
            <CouponForm
              onSubmit={handleFormSubmit}
              isSubmitting={upsertMutation.isPending}
              initialData={(selectedCoupon || suggestedData || undefined) as any}
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
              <TableHead>Visibilidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingCoupons ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  Carregando cupons...
                </TableCell>
              </TableRow>
            ) : coupons && coupons.length > 0 ? (
              coupons.map((coupon) => (
                <TableRow key={coupon.id} className={coupon.is_admin_only ? "bg-orange-50/40" : ""}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {coupon.name}
                      {coupon.is_admin_only && (
                        <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-700 bg-orange-50 gap-1 px-1.5">
                          <ShieldCheck className="w-3 h-3" /> Admin
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="max-w-[200px] truncate text-sm text-muted-foreground" title={coupon.description || ""}>
                      {coupon.description || "-"}
                    </p>
                  </TableCell>
                  <TableCell>{formatDiscount(coupon)}</TableCell>
                  <TableCell>{coupon.points_cost}</TableCell>
                  <TableCell>{coupon.stock_quantity === -1 ? "Ilimitado" : coupon.stock_quantity}</TableCell>
                  <TableCell>
                    {coupon.is_admin_only ? (
                      <Badge variant="outline" className="text-orange-700 border-orange-300 bg-orange-50 gap-1 text-[11px]">
                        <ShieldCheck className="w-3 h-3" /> Só Admin
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 text-[11px]">
                        Público
                      </Badge>
                    )}
                  </TableCell>
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
                <TableCell colSpan={8} className="text-center">
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
