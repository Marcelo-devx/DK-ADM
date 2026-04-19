"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { CouponForm } from "@/components/dashboard/coupon-form";
import { showSuccess, showError } from "@/utils/toast";
import { PlusCircle, MoreHorizontal, Ticket, ShieldCheck, Percent, Pencil, Trash2, Infinity } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

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
  if (coupon.discount_type === "shipping") return "Frete Grátis";
  if (coupon.discount_type === "percentage") return `${coupon.discount_value}%`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(coupon.discount_value);
};

const formatDiscountBadge = (coupon: Coupon) => {
  if (coupon.discount_type === "shipping")
    return <Badge className="bg-green-100 text-green-700 border-green-200 font-bold">🚚 Frete Grátis</Badge>;
  if (coupon.discount_type === "percentage")
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200 font-bold"><Percent className="w-3 h-3 mr-1" />{coupon.discount_value}%</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-bold">
    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(coupon.discount_value)}
  </Badge>;
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

  const { data: coupons, isLoading } = useQuery<Coupon[]>({
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
    onError: (error: Error) => showError(`Erro ao salvar cupom: ${error.message}`),
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
    onError: (error: Error) => showError(`Erro ao remover cupom: ${error.message}`),
  });

  const handleStatusChange = (coupon: Coupon, newStatus: boolean) => {
    upsertMutation.mutate({ ...coupon, is_active: newStatus });
  };

  const openEdit = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setIsModalOpen(true);
  };

  const openDelete = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setIsDeleteAlertOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Ticket className="h-7 w-7 text-pink-600" /> Cupons de Desconto
        </h1>
        <Dialog open={isModalOpen} onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) { setSelectedCoupon(null); setSuggestedData(null); }
        }}>
          <DialogTrigger asChild>
            <Button className="font-bold">
              <PlusCircle className="w-4 h-4 mr-2" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedCoupon ? "Editar Cupom" : suggestedData ? "Criar Cupom Sugerido" : "Novo Cupom"}
              </DialogTitle>
            </DialogHeader>
            <CouponForm
              onSubmit={(v: any) => upsertMutation.mutate(v)}
              isSubmitting={upsertMutation.isPending}
              initialData={(selectedCoupon || suggestedData || undefined) as any}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-4 animate-pulse h-24" />
          ))
        ) : coupons?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Ticket className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p>Nenhum cupom encontrado.</p>
          </div>
        ) : (
          coupons?.map((coupon) => (
            <div
              key={coupon.id}
              className={cn(
                "bg-white rounded-xl border-2 p-4 shadow-sm space-y-3",
                coupon.is_admin_only ? "border-orange-200 bg-orange-50/30" : "border-gray-100"
              )}
            >
              {/* Nome + badges */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-base text-gray-900">{coupon.name}</p>
                    {coupon.is_admin_only && (
                      <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-700 bg-orange-50 gap-1 px-1.5">
                        <ShieldCheck className="w-3 h-3" /> Admin
                      </Badge>
                    )}
                  </div>
                  {coupon.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{coupon.description}</p>
                  )}
                </div>
                {/* Status switch */}
                <Switch
                  checked={coupon.is_active}
                  onCheckedChange={(v) => handleStatusChange(coupon, v)}
                  disabled={upsertMutation.isPending}
                />
              </div>

              {/* Info row */}
              <div className="flex flex-wrap gap-2 items-center">
                {formatDiscountBadge(coupon)}
                <Badge variant="outline" className="text-xs gap-1">
                  {coupon.stock_quantity === -1 ? <><Infinity className="w-3 h-3" /> Ilimitado</> : `${coupon.stock_quantity} un.`}
                </Badge>
                {coupon.points_cost > 0 && (
                  <Badge variant="outline" className="text-xs text-yellow-700 border-yellow-300 bg-yellow-50">
                    🏆 {coupon.points_cost} pts
                  </Badge>
                )}
                {coupon.minimum_order_value > 0 && (
                  <Badge variant="outline" className="text-xs text-gray-600">
                    Mín: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(coupon.minimum_order_value)}
                  </Badge>
                )}
                <Badge variant={coupon.is_active ? "outline" : "secondary"} className={cn("text-xs ml-auto", coupon.is_active ? "text-green-700 border-green-300 bg-green-50" : "text-gray-500")}>
                  {coupon.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </div>

              {/* Ações */}
              <div className="flex gap-2 pt-1 border-t border-gray-100">
                <Button size="sm" variant="outline" className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => openEdit(coupon)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => openDelete(coupon)}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden md:block bg-white rounded-lg shadow">
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
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center">Carregando cupons...</TableCell></TableRow>
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
                    <p className="max-w-[200px] truncate text-sm text-muted-foreground">{coupon.description || "-"}</p>
                  </TableCell>
                  <TableCell>
                    {coupon.discount_type === "shipping" ? (
                      <span className="font-bold text-green-600">Frete Grátis</span>
                    ) : coupon.discount_type === "percentage" ? (
                      <span className="font-bold text-blue-600 flex items-center gap-1"><Percent className="w-3 h-3" />{coupon.discount_value}%</span>
                    ) : (
                      <span className="font-bold text-green-600">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(coupon.discount_value)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{coupon.points_cost}</TableCell>
                  <TableCell>{coupon.stock_quantity === -1 ? "Ilimitado" : coupon.stock_quantity}</TableCell>
                  <TableCell>
                    {coupon.is_admin_only ? (
                      <Badge variant="outline" className="text-orange-700 border-orange-300 bg-orange-50 gap-1 text-[11px]">
                        <ShieldCheck className="w-3 h-3" /> Só Admin
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 text-[11px]">Público</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch checked={coupon.is_active} onCheckedChange={(v) => handleStatusChange(coupon, v)} disabled={upsertMutation.isPending} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => openEdit(coupon)}>Editar</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onSelect={() => openDelete(coupon)}>Remover</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={8} className="text-center">Nenhum cupom encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cupom "{selectedCoupon?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedCoupon && deleteMutation.mutate(selectedCoupon.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CouponsPage;
