"use client";

import { NavLink } from "react-router-dom";
import { 
  Package, Home, LayoutGrid, Cloud, Image, Tags, Settings, Percent, 
  MessageSquare, Users, ListTree, GalleryHorizontal, Star, Ticket, Plug, 
  ShoppingCart, DollarSign, Truck, Coins, Printer, Map as MapIcon, 
  Lock, FileOutput, FileUp, Workflow, BarChart3, Box
} from "lucide-react";
import { cn } from "@/lib/utils";

const Sidebar = () => {
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center px-3 py-2 text-gray-600 rounded-lg transition-all duration-200 text-sm font-medium hover:bg-gray-100 hover:text-gray-900",
      isActive && "bg-white text-primary shadow-sm ring-1 ring-black/5 font-bold"
    );

  const sectionTitleClass = "px-3 mt-6 mb-2 text-xs font-black text-gray-400 uppercase tracking-wider";

  return (
    <aside className="w-64 h-screen bg-gray-50/80 border-r border-gray-200 flex flex-col">
      <div className="p-6 pb-2">
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-gray-900">
          <Box className="w-8 h-8 fill-primary text-primary" />
          Tabacaria
        </h1>
      </div>
      
      <nav className="flex-1 overflow-y-auto px-3 pb-6 space-y-1 custom-scrollbar">
        
        {/* VISÃO GERAL */}
        <p className={sectionTitleClass}>Visão Geral</p>
        <NavLink to="/dashboard" end className={navLinkClass}>
          <Home className="w-4 h-4 mr-3 text-blue-600" />
          Dashboard
        </NavLink>
        <NavLink to="/dashboard/analytics" className={navLinkClass}>
          <BarChart3 className="w-4 h-4 mr-3 text-purple-600" />
          Analytics
        </NavLink>

        {/* VENDAS & FINANCEIRO */}
        <p className={sectionTitleClass}>Vendas</p>
        <NavLink to="/dashboard/orders" className={navLinkClass}>
          <DollarSign className="w-4 h-4 mr-3 text-green-600" />
          Pedidos (Clientes)
        </NavLink>
        <NavLink to="/dashboard/prices" className={navLinkClass}>
          <Coins className="w-4 h-4 mr-3 text-yellow-600" />
          Gestão de Preços
        </NavLink>

        {/* LOGÍSTICA */}
        <p className={sectionTitleClass}>Logística</p>
        <NavLink to="/dashboard/delivery-routes" className={navLinkClass}>
          <MapIcon className="w-4 h-4 mr-3 text-indigo-500" />
          Rotas de Entrega
        </NavLink>
        <NavLink to="/dashboard/spoke-export" className={navLinkClass}>
          <FileOutput className="w-4 h-4 mr-3 text-indigo-400" />
          Exportar Rotas
        </NavLink>
        <NavLink to="/dashboard/print-labels" className={navLinkClass}>
          <Printer className="w-4 h-4 mr-3 text-gray-600" />
          Imprimir Etiquetas
        </NavLink>
        <NavLink to="/dashboard/supplier-orders" className={navLinkClass}>
          <Truck className="w-4 h-4 mr-3 text-orange-600" />
          Pedidos (Fornecedor)
        </NavLink>

        {/* CATÁLOGO */}
        <p className={sectionTitleClass}>Catálogo</p>
        <NavLink to="/dashboard/products" className={navLinkClass}>
          <Package className="w-4 h-4 mr-3 text-rose-500" />
          Produtos
        </NavLink>
        <NavLink to="/dashboard/categories" className={navLinkClass}>
          <LayoutGrid className="w-4 h-4 mr-3 text-rose-400" />
          Categorias
        </NavLink>
        <NavLink to="/dashboard/sub-categories" className={navLinkClass}>
          <ListTree className="w-4 h-4 mr-3 text-rose-400" />
          Sub-categorias
        </NavLink>
        <NavLink to="/dashboard/brands" className={navLinkClass}>
          <Tags className="w-4 h-4 mr-3 text-rose-400" />
          Marcas
        </NavLink>

        {/* CLIENTES */}
        <p className={sectionTitleClass}>Clientes</p>
        <NavLink to="/dashboard/clients" className={navLinkClass}>
          <Users className="w-4 h-4 mr-3 text-cyan-600" />
          Base de Clientes
        </NavLink>
        <NavLink to="/dashboard/import-clients" className={navLinkClass}>
          <FileUp className="w-4 h-4 mr-3 text-cyan-500" />
          Importar Clientes
        </NavLink>

        {/* MARKETING */}
        <p className={sectionTitleClass}>Marketing</p>
        <NavLink to="/dashboard/promotions" className={navLinkClass}>
          <Percent className="w-4 h-4 mr-3 text-pink-500" />
          Kits & Promoções
        </NavLink>
        <NavLink to="/dashboard/coupons" className={navLinkClass}>
          <Ticket className="w-4 h-4 mr-3 text-pink-500" />
          Cupons
        </NavLink>
        <NavLink to="/dashboard/reviews" className={navLinkClass}>
          <Star className="w-4 h-4 mr-3 text-yellow-500" />
          Avaliações
        </NavLink>
        <NavLink to="/dashboard/sales-popups" className={navLinkClass}>
          <ShoppingCart className="w-4 h-4 mr-3 text-emerald-500" />
          Prova Social (Popups)
        </NavLink>

        {/* CUSTOMIZAÇÃO */}
        <p className={sectionTitleClass}>Conteúdo do Site</p>
        <NavLink to="/dashboard/hero-slides" className={navLinkClass}>
          <Image className="w-4 h-4 mr-3 text-violet-500" />
          Banners (Slides)
        </NavLink>
        <NavLink to="/dashboard/home-content" className={navLinkClass}>
          <GalleryHorizontal className="w-4 h-4 mr-3 text-violet-500" />
          Conteúdo da Home
        </NavLink>
        <NavLink to="/dashboard/popups" className={navLinkClass}>
          <MessageSquare className="w-4 h-4 mr-3 text-violet-500" />
          Avisos Informativos
        </NavLink>
        <NavLink to="/dashboard/flavors" className={navLinkClass}>
          <Cloud className="w-4 h-4 mr-3 text-violet-400" />
          Sabores
        </NavLink>

        {/* SISTEMA */}
        <p className={sectionTitleClass}>Sistema</p>
        <NavLink to="/dashboard/integrations" className={navLinkClass}>
          <Plug className="w-4 h-4 mr-3 text-slate-600" />
          Integrações
        </NavLink>
        <NavLink to="/dashboard/n8n" className={navLinkClass}>
          <Workflow className="w-4 h-4 mr-3 text-orange-500" />
          Automação (N8N)
        </NavLink>
        <NavLink to="/dashboard/cloudinary-stats" className={navLinkClass}>
          <Cloud className="w-4 h-4 mr-3 text-sky-500" />
          Cloudinary (Mídia)
        </NavLink>
        <NavLink to="/dashboard/secrets" className={navLinkClass}>
          <Lock className="w-4 h-4 mr-3 text-slate-500" />
          Segurança (Keys)
        </NavLink>
        <NavLink to="/dashboard/settings" className={navLinkClass}>
          <Settings className="w-4 h-4 mr-3 text-slate-500" />
          Configurações
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;