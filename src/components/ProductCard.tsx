import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Package } from "lucide-react";

interface ProductCardProps {
  product: {
    id: number;
    name: string;
    price: number;
    pix_price?: number | null;
    image_url: string | null;
    brand: string | null;
  };
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <Link to={`/produto/${product.id}`} className="group">
      <Card className="overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 bg-white h-full flex flex-col">
        <div className="relative aspect-square overflow-hidden bg-gray-50">
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.name} 
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <Package size={48} />
            </div>
          )}
          {product.brand && (
            <Badge variant="secondary" className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-[10px] uppercase font-bold">
              {product.brand}
            </Badge>
          )}
        </div>
        
        <CardContent className="p-4 flex-1">
          <h3 className="font-bold text-gray-800 line-clamp-2 text-sm group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          <div className="mt-3 space-y-1">
            <p className="text-xs text-muted-foreground line-through">
                {formatCurrency(product.price)}
            </p>
            <p className="text-xl font-black text-primary flex items-center gap-1">
                {formatCurrency(product.pix_price || product.price)}
                <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1 rounded">PIX</span>
            </p>
          </div>
        </CardContent>

        <CardFooter className="p-4 pt-0">
          <div className="w-full h-10 bg-primary text-primary-foreground flex items-center justify-center rounded-lg font-bold text-xs gap-2 group-hover:bg-primary/90 transition-all">
            <ShoppingCart size={14} /> VER DETALHES
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
};