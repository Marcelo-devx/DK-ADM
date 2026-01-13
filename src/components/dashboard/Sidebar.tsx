"use client";

import { NavLink } from "react-router-dom";
import { Package, Home, LayoutGrid, Cloud, Image, Tags, Settings, Percent, MessageSquare, Users, ListTree, GalleryHorizontal, Star, Ticket, Plug, ShoppingCart, DollarSign, Truck, Coins, Printer, Map as MapIcon, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const Sidebar = () => {
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center px-4 py-2 text-gray-700 rounded-lg hover:bg-gray-200",
      isActive && "bg-gray-300 font-bold"
    );

  return (
    <aside className="w-64 h-screen bg-gray-100 p-4 flex flex-col">
      <h1 className="text-2xl font-bold mb-8">Tabacaria</h1>
      <nav className="flex flex-col space-y-2 overflow-y-auto flex-1 text-sm">
        <NavLink to="/dashboard" end className={navLinkClass}>
          <Home className="w-4 h-4 mr-3" />
          Dashboard
        </NavLink>
        <NavLink to="/dashboard/orders" className={navLinkClass}>
          <DollarSign className="w-4 h-4 mr-3" />
          Vendas (Clientes)
        </NavLink>
        <NavLink to="/dashboard/delivery-routes" className={navLinkClass}>
          <MapIcon className="w-4 h-4 mr-3" />
          Rotas de Entrega
        </NavLink>
        <NavLink to="/dashboard/print-labels" className={navLinkClass}>
          <Printer className="w-4 h-4 mr-3" />
          Impressão
        </NavLink>
        <NavLink to="/dashboard/prices" className={navLinkClass}>
          <Coins className="w-4 h-4 mr-3" />
          Gestão de Preços
        </NavLink>
        <NavLink to="/dashboard/supplier-orders" className={navLinkClass}>
          <Truck className="w-4 h-4 mr-3" />
          Pedidos (Fornecedor)
        </NavLink>
        <NavLink to="/dashboard/products" className={navLinkClass}>
          <Package className="w-4 h-4 mr-3" />
          Produtos
        </NavLink>
        <NavLink to="/dashboard/clients" className={navLinkClass}>
          <Users className="w-4 h-4 mr-3" />
          Clientes
        </NavLink>
        <NavLink to="/dashboard/categories" className={navLinkClass}>
          <LayoutGrid className="w-4 h-4 mr-3" />
          Categorias
        </NavLink>
        <NavLink to="/dashboard/sub-categories" className={navLinkClass}>
          <ListTree className="w-4 h-4 mr-3" />
          Sub-categorias
        </NavLink>
        <NavLink to="/dashboard/brands" className={navLinkClass}>
          <Tags className="w-4 h-4 mr-3" />
          Marcas
        </NavLink>
        <NavLink to="/dashboard/promotions" className={navLinkClass}>
          <Percent className="w-4 h-4 mr-3" />
          Promoções
        </NavLink>
        <NavLink to="/dashboard/coupons" className={navLinkClass}>
          <Ticket className="w-4 h-4 mr-3" />
          Cupons
        </NavLink>
        <NavLink to="/dashboard/hero-slides" className={navLinkClass}>
          <Image className="w-4 h-4 mr-3" />
          Banners da Home
        </NavLink>
        <NavLink to="/dashboard/home-content" className={navLinkClass}>
          <GalleryHorizontal className="w-4 h-4 mr-3" />
          Conteúdo da Home
        </NavLink>
        <NavLink to="/dashboard/popups" className={navLinkClass}>
          <MessageSquare className="w-4 h-4 mr-3" />
          Popups Informativos
        </NavLink>
        <NavLink to="/dashboard/sales-popups" className={navLinkClass}>
          <ShoppingCart className="w-4 h-4 mr-3" />
          Popups de Venda
        </NavLink>
        <NavLink to="/dashboard/reviews" className={navLinkClass}>
          <Star className="w-4 h-4 mr-3" />
          Avaliações
        </NavLink>
        <NavLink to="/dashboard/cloudinary-stats" className={navLinkClass}>
          <Cloud className="w-4 h-4 mr-3" />
          Cloudinary Stats
        </NavLink>
        <NavLink to="/dashboard/integrations" className={navLinkClass}>
          <Plug className="w-4 h-4 mr-3" />
          Integrações
        </NavLink>
        <NavLink to="/dashboard/secrets" className={navLinkClass}>
          <Lock className="w-4 h-4 mr-3" />
          Secrets
        </NavLink>
        <NavLink to="/dashboard/settings" className={navLinkClass}>
          <Settings className="w-4 h-4 mr-3" />
          Configurações
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;