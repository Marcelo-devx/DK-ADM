"use client";

import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import {
  Home,
  BarChart3,
  Lightbulb,
  DollarSign,
  Coins,
  Heart,
  Bitcoin,
  Bike,
  Map as MapIcon,
  FileOutput,
  Printer,
  Truck,
  Package,
  LayoutGrid,
  ListTree,
  Tags,
  Users,
  UserPlus,
  FileUp,
  Crown,
  TicketCheck,
  Percent,
  Ticket,
  Star,
  ShoppingCart,
  Image,
  GalleryHorizontal,
  MessageSquare,
  Webhook,
  Plug,
  Workflow,
  Cloud,
  Lock,
  Settings,
  LogOut,
  Box,
  Globe,
  Gift,
  Award,
  ShieldAlert,
  FileEdit,
  Truck as TruckIcon,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { useSidebar } from "./DashboardLayout";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLogistica, isAdmin } = useUser();
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  // Fecha sidebar ao navegar (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center px-3 py-2 text-slate-600 rounded-lg transition-colors duration-200 text-sm font-medium hover:bg-slate-200/60 hover:text-slate-900 group",
      isActive && "bg-primary/10 text-primary font-semibold"
    );

  const sectionTitleClass = "px-3 mt-6 mb-2 text-xs font-black text-gray-400 uppercase tracking-wider";

  const iconClass = (color: string, isActive: boolean) =>
    cn("w-4 h-4 mr-3 transition-colors", isActive ? "text-primary" : color);

  const sidebarContent = (
    <>
      {/* Header da sidebar */}
      <div className="p-6 pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-gray-900">
          <Box className="w-8 h-8 fill-primary text-primary" />
          Tabacaria
        </h1>
        {/* Botão fechar — só aparece no mobile */}
        <button
          className="lg:hidden p-1 rounded-lg hover:bg-gray-200 text-gray-500"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {isLogistica && !isAdmin && (
        <span className="mx-6 mt-1 mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider">
          <TruckIcon className="w-3 h-3" />
          Logística
        </span>
      )}

      <nav className="flex-1 overflow-y-auto px-3 pb-6 space-y-1 custom-scrollbar">
        {isLogistica && !isAdmin ? (
          <>
            <p className={sectionTitleClass}>Logística</p>
            <NavLink to="/dashboard/orders" className={navLinkClass}>
              {({ isActive }) => (<><DollarSign className={iconClass("text-green-600", isActive)} />Pedidos (Clientes)</>)}
            </NavLink>
            <NavLink to="/dashboard/spoke-export" className={navLinkClass}>
              {({ isActive }) => (<><FileOutput className={iconClass("text-green-600", isActive)} />Exportar Rotas</>)}
            </NavLink>
            <NavLink to="/dashboard/print-labels" className={navLinkClass}>
              {({ isActive }) => (<><Printer className={iconClass("text-indigo-600", isActive)} />Imprimir Etiquetas</>)}
            </NavLink>
          </>
        ) : (
          <>
            {/* VISÃO GERAL */}
            <p className={sectionTitleClass}>Visão Geral</p>
            <NavLink to="/dashboard" end className={navLinkClass}>
              {({ isActive }) => (<><Home className={iconClass("text-slate-500", isActive)} />Dashboard</>)}
            </NavLink>
            <NavLink to="/dashboard/analytics" className={navLinkClass}>
              {({ isActive }) => (<><BarChart3 className={iconClass("text-slate-500", isActive)} />Analytics</>)}
            </NavLink>

            {/* VENDAS & FINANCEIRO */}
            <p className={sectionTitleClass}>Vendas & Financeiro</p>
            <NavLink to="/dashboard/orders" className={navLinkClass}>
              {({ isActive }) => (<><DollarSign className={iconClass("text-green-600", isActive)} />Pedidos (Clientes)</>)}
            </NavLink>
            <NavLink to="/dashboard/donations" className={navLinkClass}>
              {({ isActive }) => (<><Heart className={iconClass("text-rose-600", isActive)} />Doações</>)}
            </NavLink>
            <NavLink to="/dashboard/supplier-orders" className={navLinkClass}>
              {({ isActive }) => (<><Truck className={iconClass("text-green-600", isActive)} />Pedidos (Fornecedor)</>)}
            </NavLink>
            <NavLink to="/dashboard/crypto" className={navLinkClass}>
              {({ isActive }) => (<><Bitcoin className={iconClass("text-green-600", isActive)} />Cripto</>)}
            </NavLink>

            {/* CATÁLOGO */}
            <p className={sectionTitleClass}>Catálogo</p>
            <NavLink to="/dashboard/products" className={navLinkClass}>
              {({ isActive }) => (<><Package className={iconClass("text-blue-600", isActive)} />Produtos</>)}
            </NavLink>
            <NavLink to="/dashboard/price-management" className={navLinkClass}>
              {({ isActive }) => (<><Coins className={iconClass("text-blue-600", isActive)} />Gestão de Preços</>)}
            </NavLink>
            <NavLink to="/dashboard/categories" className={navLinkClass}>
              {({ isActive }) => (<><LayoutGrid className={iconClass("text-blue-600", isActive)} />Categorias</>)}
            </NavLink>
            <NavLink to="/dashboard/sub-categories" className={navLinkClass}>
              {({ isActive }) => (<><ListTree className={iconClass("text-blue-600", isActive)} />Sub-categorias</>)}
            </NavLink>
            <NavLink to="/dashboard/brands" className={navLinkClass}>
              {({ isActive }) => (<><Tags className={iconClass("text-blue-600", isActive)} />Marcas</>)}
            </NavLink>

            {/* LOGÍSTICA */}
            <p className={sectionTitleClass}>Logística</p>
            <NavLink to="/dashboard/spoke-export" className={navLinkClass}>
              {({ isActive }) => (<><FileOutput className={iconClass("text-green-600", isActive)} />Exportar Rotas</>)}
            </NavLink>
            <NavLink to="/dashboard/delivery-routes" className={navLinkClass}>
              {({ isActive }) => (<><MapIcon className={iconClass("text-green-600", isActive)} />Rotas de Entrega</>)}
            </NavLink>
            <NavLink to="/dashboard/shipping-rates" className={navLinkClass}>
              {({ isActive }) => (<><Bike className={iconClass("text-indigo-600", isActive)} />Fretes e Taxas</>)}
            </NavLink>
            <NavLink to="/dashboard/print-labels" className={navLinkClass}>
              {({ isActive }) => (<><Printer className={iconClass("text-indigo-600", isActive)} />Imprimir Etiquetas</>)}
            </NavLink>

            {/* INTELIGÊNCIA */}
            <p className={sectionTitleClass}>Inteligência</p>
            <NavLink to="/dashboard/metaflow-insights" className={navLinkClass}>
              {({ isActive }) => (<><Lightbulb className={iconClass("text-purple-600", isActive)} />Insights de Negócio</>)}
            </NavLink>

            {/* CLIENTES */}
            <p className={sectionTitleClass}>Clientes</p>
            <NavLink to="/dashboard/clients" className={navLinkClass}>
              {({ isActive }) => (<><Users className={iconClass("text-cyan-600", isActive)} />Base de Clientes</>)}
            </NavLink>
            <NavLink to="/dashboard/cadastrar-cliente" className={navLinkClass}>
              {({ isActive }) => (<><UserPlus className={iconClass("text-cyan-600", isActive)} />Cadastrar Cliente</>)}
            </NavLink>
            <NavLink to="/dashboard/import-clients" className={navLinkClass}>
              {({ isActive }) => (<><FileUp className={iconClass("text-cyan-600", isActive)} />Importar Clientes</>)}
            </NavLink>
            <NavLink to="/dashboard/bulk-add-points" className={navLinkClass}>
              {({ isActive }) => (<><Gift className={iconClass("text-cyan-600", isActive)} />Adicionar Pontos em Massa</>)}
            </NavLink>
            <NavLink to="/dashboard/manual-add-points" className={navLinkClass}>
              {({ isActive }) => (<><Award className={iconClass("text-cyan-600", isActive)} />Adicionar Pontos (Manual)</>)}
            </NavLink>

            {/* MARKETING */}
            <p className={sectionTitleClass}>Marketing</p>
            <NavLink to="/dashboard/coupon-management" className={navLinkClass}>
              {({ isActive }) => (<><Gift className={iconClass("text-purple-600", isActive)} />Gestão de Cupons</>)}
            </NavLink>
            <NavLink to="/dashboard/club-dk" className={navLinkClass}>
              {({ isActive }) => (<><Crown className={iconClass("text-pink-600", isActive)} />Club DK (Fidelidade)</>)}
            </NavLink>
            <NavLink to="/dashboard/user-coupons-history" className={navLinkClass}>
              {({ isActive }) => (<><TicketCheck className={iconClass("text-pink-600", isActive)} />Histórico de Cupons</>)}
            </NavLink>
            <NavLink to="/dashboard/promotions" className={navLinkClass}>
              {({ isActive }) => (<><Percent className={iconClass("text-pink-600", isActive)} />Kits & Promoções</>)}
            </NavLink>
            <NavLink to="/dashboard/coupons" className={navLinkClass}>
              {({ isActive }) => (<><Ticket className={iconClass("text-pink-600", isActive)} />Cupons</>)}
            </NavLink>

            {/* CONTEÚDO DO SITE */}
            <p className={sectionTitleClass}>Conteúdo do Site</p>
            <NavLink to="/dashboard/hero-slides" className={navLinkClass}>
              {({ isActive }) => (<><Image className={iconClass("text-amber-600", isActive)} />Banners (Slides)</>)}
            </NavLink>
            <NavLink to="/dashboard/home-content" className={navLinkClass}>
              {({ isActive }) => (<><GalleryHorizontal className={iconClass("text-amber-600", isActive)} />Conteúdo da Home</>)}
            </NavLink>
            <NavLink to="/dashboard/popups" className={navLinkClass}>
              {({ isActive }) => (<><MessageSquare className={iconClass("text-amber-600", isActive)} />Avisos Informativos</>)}
            </NavLink>
            <NavLink to="/dashboard/sales-popups" className={navLinkClass}>
              {({ isActive }) => (<><ShoppingCart className={iconClass("text-amber-600", isActive)} />Prova Social (Popups)</>)}
            </NavLink>
            <NavLink to="/dashboard/reviews" className={navLinkClass}>
              {({ isActive }) => (<><Star className={iconClass("text-amber-600", isActive)} />Avaliações</>)}
            </NavLink>

            {/* ADMINISTRAÇÃO */}
            <p className={sectionTitleClass}>Administração</p>
            <NavLink to="/dashboard/user-admin" className={navLinkClass}>
              {({ isActive }) => (<><ShieldAlert className={iconClass("text-red-600", isActive)} />Admin Usuários</>)}
            </NavLink>
            <NavLink to="/dashboard/order-admin" className={navLinkClass}>
              {({ isActive }) => (<><FileEdit className={iconClass("text-red-600", isActive)} />Admin Pedidos</>)}
            </NavLink>
            <NavLink to="/dashboard/cleanup-orders" className={navLinkClass}>
              {({ isActive }) => (<><Trash2 className={iconClass("text-red-700", isActive)} />Limpeza de Pedidos</>)}
            </NavLink>

            {/* SISTEMA */}
            <p className={sectionTitleClass}>Sistema</p>
            <NavLink to="/dashboard/incoming-webhooks" className={navLinkClass}>
              {({ isActive }) => (<><Webhook className={iconClass("text-slate-500", isActive)} />Webhooks (Entrada)</>)}
            </NavLink>
            <NavLink to="/dashboard/integrations" className={navLinkClass}>
              {({ isActive }) => (<><Plug className={iconClass("text-slate-500", isActive)} />Integrações</>)}
            </NavLink>
            <NavLink to="/dashboard/n8n-integration" className={navLinkClass}>
              {({ isActive }) => (<><Workflow className={iconClass("text-slate-500", isActive)} />Automação (N8N)</>)}
            </NavLink>
            <NavLink to="/dashboard/cloudinary-stats" className={navLinkClass}>
              {({ isActive }) => (<><Cloud className={iconClass("text-slate-500", isActive)} />Cloudinary (Mídia)</>)}
            </NavLink>
            <NavLink to="/dashboard/secrets" className={navLinkClass}>
              {({ isActive }) => (<><Lock className={iconClass("text-slate-500", isActive)} />Segurança (Keys)</>)}
            </NavLink>
            <NavLink to="/dashboard/settings" className={navLinkClass}>
              {({ isActive }) => (<><Settings className={iconClass("text-slate-500", isActive)} />Configurações</>)}
            </NavLink>
            <NavLink to="/dashboard/spoke-integration" className={navLinkClass}>
              {({ isActive }) => (<><Globe className={iconClass("text-slate-500", isActive)} />Integração Circuit</>)}
            </NavLink>
          </>
        )}
      </nav>

      {/* FOOTER COM LOGOUT */}
      <div className="p-4 border-t border-gray-200 bg-white/50">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors group"
        >
          <LogOut className="w-4 h-4 mr-3 group-hover:scale-110 transition-transform" />
          Sair do Sistema
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Overlay escuro no mobile quando sidebar está aberta */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixa no desktop, drawer no mobile */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen w-72 bg-gray-50/95 border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out",
          "lg:static lg:z-auto lg:w-64 lg:translate-x-0 lg:flex",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
};

export default Sidebar;
