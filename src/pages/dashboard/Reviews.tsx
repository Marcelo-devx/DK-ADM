import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Star, Trash2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Review = {
  id: number;
  product_id: number;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  is_approved: boolean;
};
type Product = { id: number; name: string };
type Profile = { id: string; first_name: string | null; last_name: string | null };

const fetchReviews = async () => {
  const { data, error } = await supabase.from("reviews").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as Review[];
};
const fetchProducts = async () => {
  const { data, error } = await supabase.from("products").select("id, name");
  if (error) throw new Error(error.message);
  return data as Product[];
};
const fetchProfiles = async () => {
  const { data, error } = await supabase.from("profiles").select("id, first_name, last_name");
  if (error) throw new Error(error.message);
  return data as Profile[];
};

const StarRating = ({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={cn(
          size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5",
          i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"
        )}
      />
    ))}
  </div>
);

const ReviewsPage = () => {
  const queryClient = useQueryClient();
  const [reviewToDelete, setReviewToDelete] = useState<Review | null>(null);

  const { data: reviews, isLoading: isLoadingReviews } = useQuery({ queryKey: ["reviewsAdmin"], queryFn: fetchReviews });
  const { data: products, isLoading: isLoadingProducts } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });

  const productMap = new Map(products?.map((p) => [p.id, p.name]));
  const profileMap = new Map(profiles?.map((p) => [p.id, `${p.first_name || ""} ${p.last_name || ""}`.trim()]));

  const updateMutation = useMutation({
    mutationFn: async ({ reviewId, newStatus }: { reviewId: number; newStatus: boolean }) => {
      const { error } = await supabase.from("reviews").update({ is_approved: newStatus }).eq("id", reviewId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["reviewsAdmin"] }); showSuccess("Status atualizado!"); },
    onError: (e: Error) => showError(`Erro: ${e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (reviewId: number) => {
      const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewsAdmin"] });
      setReviewToDelete(null);
      showSuccess("Avaliação removida!");
    },
    onError: (e: Error) => showError(`Erro: ${e.message}`),
  });

  const isLoading = isLoadingReviews || isLoadingProducts || isLoadingProfiles;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
        <Star className="h-7 w-7 text-yellow-500 fill-yellow-400" /> Avaliações
      </h1>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-4 animate-pulse h-28" />
          ))
        ) : reviews?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Star className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p>Nenhuma avaliação encontrada.</p>
          </div>
        ) : (
          reviews?.map((review) => (
            <div
              key={review.id}
              className={cn(
                "bg-white rounded-xl border-2 shadow-sm p-4 space-y-3",
                review.is_approved ? "border-green-100" : "border-gray-100"
              )}
            >
              {/* Produto + estrelas + aprovação */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900 leading-tight">
                    {productMap.get(review.product_id) || "Produto não encontrado"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {profileMap.get(review.user_id) || review.user_id.substring(0, 8)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={review.is_approved ? "outline" : "secondary"} className={cn("text-xs", review.is_approved ? "text-green-700 border-green-300 bg-green-50" : "text-gray-500")}>
                    {review.is_approved ? "Aprovado" : "Pendente"}
                  </Badge>
                  <Switch
                    checked={review.is_approved}
                    onCheckedChange={(v) => updateMutation.mutate({ reviewId: review.id, newStatus: v })}
                    disabled={updateMutation.isPending}
                  />
                </div>
              </div>

              {/* Estrelas + data */}
              <div className="flex items-center justify-between">
                <StarRating rating={review.rating} size="lg" />
                <span className="text-xs text-muted-foreground">
                  {new Date(review.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>

              {/* Comentário */}
              {review.comment && (
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border border-gray-100 leading-relaxed">
                  "{review.comment}"
                </p>
              )}

              {/* Ação */}
              <div className="pt-1 border-t border-gray-100">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setReviewToDelete(review)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover Avaliação
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
              <TableHead>Produto</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Avaliação</TableHead>
              <TableHead>Comentário</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Aprovado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center">Carregando avaliações...</TableCell></TableRow>
            ) : reviews && reviews.length > 0 ? (
              reviews.map((review) => (
                <TableRow key={review.id}>
                  <TableCell className="font-medium">{productMap.get(review.product_id) || "Produto não encontrado"}</TableCell>
                  <TableCell>{profileMap.get(review.user_id) || review.user_id.substring(0, 8)}</TableCell>
                  <TableCell><StarRating rating={review.rating} /></TableCell>
                  <TableCell>
                    <p className="max-w-xs truncate" title={review.comment || ""}>{review.comment || "-"}</p>
                  </TableCell>
                  <TableCell>{new Date(review.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <Switch
                      checked={review.is_approved}
                      onCheckedChange={(v) => updateMutation.mutate({ reviewId: review.id, newStatus: v })}
                      disabled={updateMutation.isPending}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setReviewToDelete(review)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={7} className="text-center">Nenhuma avaliação encontrada.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!reviewToDelete} onOpenChange={(open) => { if (!open) setReviewToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover avaliação?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReviewToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => reviewToDelete && deleteMutation.mutate(reviewToDelete.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReviewsPage;
