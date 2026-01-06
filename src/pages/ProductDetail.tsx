import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Leaf, Droplets, Ruler, PackageCheck, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  brand: string | null;
  category: string | null;
  stock_quantity: number;
}

interface Variant {
  id: string;
  flavor_id: number | null;
  volume_ml: number | null;
  price: number;
  stock_quantity: number;
  flavors: { name: string } | null;
}

const fetchProduct = async (id: string) => {
  const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Product;
};

const fetchVariants = async (productId: string) => {
  const { data, error } = await supabase
    .from('product_variants')
    .select(`*, flavors(name)`)
    .eq('product_id', productId)
    .eq('is_active', true);
  if (error) throw error;
  return data as any[];
};

const ProductDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [selectedFlavorId, setSelectedFlavorId] = useState<string>("all");
  const [selectedVolume, setSelectedVolume] = useState<string>("all");

  const { data: product, isLoading: isLoadingProduct } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id!),
  });

  const { data: variants, isLoading: isLoadingVariants } = useQuery<Variant[]>({
    queryKey: ['productVariants', id],
    queryFn: () => fetchVariants(id!),
  });

  const flavorOptions = useMemo(() => {
    const map = new Map();
    variants?.forEach(v => {
      if (v.flavors) map.set(v.flavor_id, v.flavors.name);
    });
    return Array.from(map.entries());
  }, [variants]);

  const volumeOptions = useMemo(() => {
    const set = new Set<number>();
    variants?.forEach(v => {
      if (v.volume_ml) set.add(v.volume_ml);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [variants]);

  const activeVariant = useMemo(() => {
    if (!variants) return null;
    return variants.find(v => 
      (selectedFlavorId === "all" || String(v.flavor_id) === selectedFlavorId) &&
      (selectedVolume === "all" || String(v.volume_ml) === selectedVolume)
    );
  }, [variants, selectedFlavorId, selectedVolume]);

  const displayPrice = activeVariant?.price || product?.price || 0;
  const displayStock = activeVariant ? activeVariant.stock_quantity : (variants?.length ? variants.reduce((acc, v) => acc + v.stock_quantity, 0) : product?.stock_quantity || 0);

  if (isLoadingProduct) return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        <div className="sticky top-8 h-fit">
          <Card className="overflow-hidden border-none shadow-xl">
             {product?.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full aspect-square object-cover" />
             ) : (
                <div className="w-full aspect-square bg-gray-100 flex items-center justify-center"><PackageCheck className="w-20 h-20 text-gray-300" /></div>
             )}
          </Card>
        </div>

        <div className="flex flex-col space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-primary border-primary/20">{product?.brand}</Badge>
                <Badge variant="secondary" className="opacity-70">{product?.category}</Badge>
            </div>
            <h1 className="text-4xl font-bold">{product?.name}</h1>
          </div>

          <div className="flex items-end gap-3">
             <span className="text-4xl font-black text-primary">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(displayPrice)}
             </span>
             {activeVariant && <span className="text-sm text-muted-foreground mb-1">Preço da variação</span>}
          </div>

          <Card className="border-primary/10 bg-primary/5">
            <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {flavorOptions.length > 0 && (
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-xs font-bold uppercase"><Droplets className="w-3 h-3" /> Escolha o Sabor</Label>
                            <Select value={selectedFlavorId} onValueChange={setSelectedFlavorId}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="Todos os Sabores" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Ver Todos</SelectItem>
                                    {flavorOptions.map(([id, name]) => <SelectItem key={id} value={String(id)}>{name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {volumeOptions.length > 0 && (
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-xs font-bold uppercase"><Ruler className="w-3 h-3" /> Escolha o Tamanho</Label>
                            <Select value={selectedVolume} onValueChange={setSelectedVolume}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="Todos os Tamanhos" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Ver Todos</SelectItem>
                                    {volumeOptions.map(v => <SelectItem key={String(v)} value={String(v)}>{v}ml</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between border-t border-primary/10 pt-4">
                    <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground uppercase font-bold">Disponibilidade</span>
                        <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-full", displayStock > 0 ? "bg-green-500" : "bg-red-500")} />
                            <span className="font-medium">{displayStock > 0 ? `${displayStock} unidades em estoque` : "Esgotado"}</span>
                        </div>
                    </div>
                    <Button size="lg" disabled={displayStock === 0} className="px-8 font-bold">
                        {displayStock === 0 ? "Avise-me" : "Comprar Agora"}
                    </Button>
                </div>
                
                {(!activeVariant && (selectedFlavorId !== "all" || selectedVolume !== "all")) && (
                    <div className="flex items-center gap-2 text-orange-600 bg-orange-50 p-2 rounded text-xs font-medium">
                        <AlertCircle className="w-4 h-4" /> Esta combinação específica não está disponível.
                    </div>
                )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="font-bold text-lg border-b pb-2">Descrição</h3>
            <p className="text-gray-600 leading-relaxed">{product?.description || "Sem descrição disponível para este produto."}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;