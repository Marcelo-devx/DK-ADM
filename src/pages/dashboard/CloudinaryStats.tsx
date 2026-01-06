import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Cloud, Image, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { showSuccess, showError } from "@/utils/toast";

interface CloudinaryResource {
  asset_id: string;
  public_id: string;
  format: string;
  created_at: string;
  bytes: number;
  secure_url: string;
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

const fetchCloudinaryStats = async () => {
  const { data, error } = await supabase.functions.invoke("cloudinary-usage");
  if (error) throw new Error(error.message);
  return data;
};

const fetchCloudinaryImages = async () => {
  const { data, error } = await supabase.functions.invoke(
    "cloudinary-list-images"
  );
  if (error) throw new Error(error.message);
  return data;
};

const CloudinaryStatsPage = () => {
  const queryClient = useQueryClient();

  const {
    data: stats,
    isLoading: isLoadingStats,
    error: statsError,
  } = useQuery({
    queryKey: ["cloudinaryStats"],
    queryFn: fetchCloudinaryStats,
    refetchInterval: 60000,
  });

  const {
    data: images,
    isLoading: isLoadingImages,
    error: imagesError,
  } = useQuery<CloudinaryResource[]>({
    queryKey: ["cloudinaryImages"],
    queryFn: fetchCloudinaryImages,
    refetchInterval: 60000,
  });

  const deleteImageMutation = useMutation({
    mutationFn: async (publicId: string) => {
      const { error } = await supabase.functions.invoke("cloudinary-delete-image", {
        body: { public_id: publicId },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cloudinaryImages"] });
      queryClient.invalidateQueries({ queryKey: ["cloudinaryStats"] });
      showSuccess("Imagem removida com sucesso!");
    },
    onError: (error) => {
      showError(`Erro ao remover imagem: ${error.message}`);
    },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Cloudinary</h1>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Cloud className="mr-2 h-5 w-5" />
              Visão Geral do Uso
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : statsError ? (
              <p className="text-red-500">
                Falha ao carregar estatísticas: {(statsError as Error).message}
              </p>
            ) : stats && stats.storage ? (
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="text-lg font-semibold">Armazenamento</h3>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>
                        {formatBytes(stats.storage.usage)} de{" "}
                        {formatBytes(stats.storage.limit)}
                      </span>
                      <span className="font-medium">
                        {(stats.storage.used_percent ?? 0).toFixed(2)}%
                      </span>
                    </div>
                    <Progress
                      value={stats.storage.used_percent ?? 0}
                      className="h-2"
                    />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Recursos</h3>
                  <div className="mt-2">
                    <p className="text-2xl font-bold">{stats.resources ?? 0}</p>
                    <p className="text-xs text-muted-foreground">
                      Total de arquivos na nuvem
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p>Nenhuma estatística encontrada.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Image className="mr-2 h-5 w-5" />
              Imagens Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingImages ? (
              <Skeleton className="h-40 w-full" />
            ) : imagesError ? (
              <p className="text-red-500">
                Falha ao carregar imagens: {(imagesError as Error).message}
              </p>
            ) : images && images.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Preview</TableHead>
                      <TableHead>Public ID</TableHead>
                      <TableHead>Formato</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Data de Criação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {images.map((image) => (
                      <TableRow key={image.asset_id}>
                        <TableCell>
                          <img
                            src={image.secure_url}
                            alt={image.public_id}
                            className="h-12 w-12 rounded-md object-cover"
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {image.public_id}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{image.format}</Badge>
                        </TableCell>
                        <TableCell>{formatBytes(image.bytes)}</TableCell>
                        <TableCell>
                          {new Date(image.created_at).toLocaleDateString(
                            "pt-BR"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={deleteImageMutation.isPending}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Essa ação não pode ser desfeita. Isso removerá permanentemente a imagem do Cloudinary.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteImageMutation.mutate(image.public_id)}>
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p>Nenhuma imagem encontrada.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CloudinaryStatsPage;