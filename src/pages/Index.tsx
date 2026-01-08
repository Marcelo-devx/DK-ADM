import { MadeWithDyad } from "@/components/made-with-dyad";
import { useUser } from "@/hooks/useUser";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ProductGrid } from "@/components/ProductGrid";
import { ShoppingBag, Flame } from "lucide-react";

const Index = () => {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
            <ShoppingBag className="w-12 h-12 text-primary/20" />
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Carregando Vitrine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Banner Principal */}
      <section className="w-full">
        <HeroCarousel />
      </section>

      {/* Conteúdo Principal */}
      <main className="container mx-auto px-4 py-12 flex-1">
        <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
                <h2 className="text-3xl font-black italic uppercase tracking-tight flex items-center gap-2">
                    <Flame className="text-orange-500 fill-orange-500 w-7 h-7" />
                    Novidades da Semana
                </h2>
                <p className="text-muted-foreground text-sm font-medium">Confira os itens mais procurados que acabaram de chegar.</p>
            </div>
        </div>

        {/* Grade de Produtos (Filtra estoque automaticamente) */}
        <ProductGrid />
      </main>

      {/* Footer / Info */}
      <footer className="bg-white border-t py-12 mt-12">
        <div className="container mx-auto px-4 text-center">
            <h3 className="text-xl font-bold mb-4 italic uppercase">Tabacaria Oficial</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8">
                A melhor seleção de itens para sua sessão. Qualidade garantida e entrega rápida em todo o Brasil.
            </p>
            <MadeWithDyad />
        </div>
      </footer>
    </div>
  );
};

export default Index;