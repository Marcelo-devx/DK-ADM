import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Star, Trash2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

// Types
type Review = {
  id: number;
  product_id: number;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  is_approved: boolean;
};

type Product = {
  id: number;
  name: string;
};

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

// Fetch functions
const fetchReviews = async () => {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false });
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

const ReviewsPage = () => {
  const queryClient = useQueryClient();
  const [reviewToDelete, setReviewToDelete] = useState<Review | null>(null);

  // Queries
  const { data: reviews, isLoading: isLoadingReviews } = useQuery({ queryKey: ["reviewsAdmin"], queryFn: fetchReviews });
  const { data: products, isLoading: isLoadingProducts } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });

  // Create maps for easy lookup
  const productMap = new Map(products?.map(p => [p.id, p.name]));
  const profileMap = new Map(profiles?.map(p => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim()]));

  // Mutations
  const updateReviewMutation = useMutation({
    mutationFn: async ({ reviewId, newStatus }: { reviewId: number; newStatus: boolean }) => {
      const { error } = await supabase
        .from("reviews")
        .update({ is_approved: newStatus })
        .eq("id", reviewId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewsAdmin"] });
      showSuccess("Status da avaliação atualizado!");
    },
    onError: (error: Error) => {
      showError(`Erro ao atualizar: ${error.message}`);
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: number) => {
      const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewsAdmin"] });
      setReviewToDelete(null);
      showSuccess("Avaliação removida com sucesso!");
    },
    onError: (error: Error) => {
      showError(`Erro ao remover: ${error.message}`);
    },
  });

  const isLoading = isLoadingReviews || isLoadingProducts || isLoadingProfiles;

  return (
    <AlertDialog>
      <div>
        <h1 className="text-3xl font-bold mb-6">Gerenciar Avaliações</h1>
        <div className="bg-white rounded-lg shadow">
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
                    <TableCell className="font-medium">{productMap.get(review.product_id) || 'Produto não encontrado'}</TableCell>
                    <TableCell>{profileMap.get(review.user_id) || review.user_id.substring(0, 8)}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {Array.from({ length: review.rating }).map((_, i) => (
                          <Star key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                        ))}
                        {Array.from({ length: 5 - review.rating }).map((_, i) => (
                          <Star key={i} className="h-4 w-4 text-gray-300" />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-xs truncate" title={review.comment || ''}>
                        {review.comment || "-"}
                      </p>
                    </TableCell>
                    <TableCell>{new Date(review.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <Switch
                        checked={review.is_approved}
                        onCheckedChange={(newStatus) => updateReviewMutation.mutate({ reviewId: review.id, newStatus })}
                        disabled={updateReviewMutation.isPending}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setReviewToDelete(review)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </AlertDialogTrigger>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={7} className="text-center">Nenhuma avaliação encontrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso removerá permanentemente a avaliação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReviewToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => reviewToDelete && deleteReviewMutation.mutate(reviewToDelete.id)} disabled={deleteReviewMutation.isPending}>
              {deleteReviewMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </div>
    </AlertDialog>
  );
};

export default ReviewsPage;