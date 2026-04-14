"use client";

import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import {
  Home,
  BarChart3,
  DollarSign,
  Heart,
  Bike,
  FileOutput,
  Printer,
  Package,
  Users,
  UserPlus,
  Crown,
  TicketCheck,
  Percent,
  Ticket,
  ShieldAlert,
  FileEdit,
  X,
  Box,
  Truck as TruckIcon,
  LogOut,
  Settings,
  Tag,
  Layers,
  Star,
  Image,
  LayoutDashboard,
  Webhook,
  KeyRound,
  Cloud,
  TrendingUp,
  DollarSign as PriceIcon,
  UserCheck,
  Route,
  Gift,
  Trash2,
  ShoppingCart,
  Zap,
  FileSearch,
  FileDown,
  Search,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { useSidebar } from "./DashboardLayout";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLogistica, isAdmin, isGerente, isGerenteGeral } = useUser();
  const { sidebarOpen, setSidebarOpen } = useSidebar();

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

  // gerente_geral has full admin access
  const isFullAccess = isAdmin || isGerenteGeral;

  const fullMenu = isAdmin ? (
    <>
      {/* VISÃO GERAL */}
      <p className={sectionTitleClass}>Visão Geral</p>
      <NavLink to="/dashboard" end className={navLinkClass}>
        {({ isActive }) => (<><Home className={iconClass("text-slate-500", isActive)} />Dashboard</>)}
      </NavLink>
      <NavLink to="/dashboard/analytics" className={navLinkClass}>
        {({ isActive }) => (<><BarChart3 className={iconClass("text-slate-500", isActive)} />Analytics</>)}
      </NavLink>
      <NavLink to="/dashboard/metaflow-insights" className={navLinkClass}>
        {({ isActive }) => (<><TrendingUp className={iconClass("text-slate-500", isActive)} />Metaflow Insights</>)}
      </NavLink>

      {/* OPERAÇÃO */}
      <p className={sectionTitleClass}>Operação</p>
      <NavLink to="/dashboard/orders" className={navLinkClass}>
        {({ isActive }) => (<><DollarSign className={iconClass("text-green-600", isActive)} />Pedidos (Clientes)</>)}
      </NavLink>
      <NavLink to="/dashboard/donations" className={navLinkClass}>
        {({ isActive }) => (<><Heart className={iconClass("text-rose-600", isActive)} />Doações</>)}
      </NavLink>
      <NavLink to="/dashboard/delivery-routes" className={navLinkClass}>
        {({ isActive }) => (<><Route className={iconClass("text-orange-600", isActive)} />Rotas de Entrega</>)}
      </NavLink>
      <NavLink to="/dashboard/spoke-export" className={navLinkClass}>
        {({ isActive }) => (<><FileOutput className={iconClass("text-green-600", isActive)} />Exportar Rotas</>)}
      </NavLink>
      <NavLink to="/dashboard/print-labels" className={navLinkClass}>
        {({ isActive }) => (<><Printer className={iconClass("text-indigo-600", isActive)} />Imprimir Etiquetas</>)}
      </NavLink>
      <NavLink to="/dashboard/supplier-orders" className={navLinkClass}>
        {({ isActive }) => (<><ShoppingCart className={iconClass("text-amber-600", isActive)} />Pedidos Fornecedor</>)}
      </NavLink>

      {/* CATÁLOGO */}
      <p className={sectionTitleClass}>Catálogo</p>
      <NavLink to="/dashboard/products" className={navLinkClass}>
        {({ isActive }) => (<><Package className={iconClass("text-blue-600", isActive)} />Produtos</>)}
      </NavLink>
      <NavLink to="/dashboard/categories" className={navLinkClass}>
        {({ isActive }) => (<><Layers className={iconClass("text-blue-500", isActive)} />Categorias</>)}
      </NavLink>
      <NavLink to="/dashboard/sub-categories" className={navLinkClass}>
        {({ isActive }) => (<><Layers className={iconClass("text-blue-400", isActive)} />Sub-Categorias</>)}
      </NavLink>
      <NavLink to="/dashboard/brands" className={navLinkClass}>
        {({ isActive }) => (<><Tag className={iconClass("text-blue-600", isActive)} />Marcas</>)}
      </NavLink>
      <NavLink to="/dashboard/flavors" className={navLinkClass}>
        {({ isActive }) => (<><Zap className={iconClass("text-yellow-500", isActive)} />Sabores</>)}
      </NavLink>
      <NavLink to="/dashboard/price-management" className={navLinkClass}>
        {({ isActive }) => (<><PriceIcon className={iconClass("text-green-700", isActive)} />Gestão de Preços</>)}
      </NavLink>
      <NavLink to="/dashboard/reviews" className={navLinkClass}>
        {({ isActive }) => (<><Star className={iconClass("text-yellow-500", isActive)} />Avaliações</>)}
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
        {({ isActive }) => (<><UserCheck className={iconClass("text-cyan-700", isActive)} />Importar Clientes</>)}
      </NavLink>

      {/* FIDELIDADE & PROMOÇÕES */}
      <p className={sectionTitleClass}>Fidelidade & Promoções</p>
      <NavLink to="/dashboard/club-dk" className={navLinkClass}>
        {({ isActive }) => (<><Crown className={iconClass("text-pink-600", isActive)} />Club DK Fidelidade</>)}
      </NavLink>
      <NavLink to="/dashboard/loyalty-management" className={navLinkClass}>
        {({ isActive }) => (<><Gift className={iconClass("text-pink-500", isActive)} />Gestão de Fidelidade</>)}
      </NavLink>
      <NavLink to="/dashboard/user-coupons-history" className={navLinkClass}>
        {({ isActive }) => (<><TicketCheck className={iconClass("text-pink-600", isActive)} />Histórico de Cupons</>)}
      </NavLink>
      <NavLink to="/dashboard/coupon-management" className={navLinkClass}>
        {({ isActive }) => (<><Ticket className={iconClass("text-pink-500", isActive)} />Gestão de Cupons</>)}
      </NavLink>
      <NavLink to="/dashboard/promotions" className={navLinkClass}>
        {({ isActive }) => (<><Percent className={iconClass("text-pink-600", isActive)} />Kits & Promoções</>)}
      </NavLink>
      <NavLink to="/dashboard/coupons" className={navLinkClass}>
        {({ isActive }) => (<><Ticket className={iconClass("text-pink-600", isActive)} />Cupons</>)}
      </NavLink>
      <NavLink to="/dashboard/bulk-add-points" className={navLinkClass}>
        {({ isActive }) => (<><Gift className={iconClass("text-pink-400", isActive)} />Pontos em Massa</>)}
      </NavLink>
      <NavLink to="/dashboard/manual-add-points" className={navLinkClass}>
        {({ isActive }) => (<><Gift className={iconClass("text-pink-400", isActive)} />Pontos Manual</>)}
      </NavLink>

      {/* CONTEÚDO */}
      <p className={sectionTitleClass}>Conteúdo</p>
      <NavLink to="/dashboard/hero-slides" className={navLinkClass}>
        {({ isActive }) => (<><Image className={iconClass("text-violet-600", isActive)} />Hero Slides</>)}
      </NavLink>
      <NavLink to="/dashboard/home-content" className={navLinkClass}>
        {({ isActive }) => (<><LayoutDashboard className={iconClass("text-violet-500", isActive)} />Conteúdo Home</>)}
      </NavLink>
      <NavLink to="/dashboard/popups" className={navLinkClass}>
        {({ isActive }) => (<><LayoutDashboard className={iconClass("text-violet-400", isActive)} />Popups</>)}
      </NavLink>
      <NavLink to="/dashboard/sales-popups" className={navLinkClass}>
        {({ isActive }) => (<><LayoutDashboard className={iconClass("text-violet-400", isActive)} />Sales Popups</>)}
      </NavLink>

      {/* LOGÍSTICA */}
      <p className={sectionTitleClass}>Logística</p>
      <NavLink to="/dashboard/shipping-rates" className={navLinkClass}>
        {({ isActive }) => (<><Bike className={iconClass("text-indigo-600", isActive)} />Fretes e Taxa</>)}
      </NavLink>

      {/* ADMINISTRAÇÃO */}
      <p className={sectionTitleClass}>Administração</p>
      <NavLink to="/dashboard/user-admin" className={navLinkClass}>
        {({ isActive }) => (<><ShieldAlert className={iconClass("text-red-600", isActive)} />Admin Usuários</>)}
      </NavLink>
      <NavLink to="/dashboard/investigar-usuario" className={navLinkClass}>
        {({ isActive }) => (<><Search className={iconClass("text-orange-600", isActive)} />Investigar Usuário</>)}
      </NavLink>
      <NavLink to="/dashboard/order-admin" className={navLinkClass}>
        {({ isActive }) => (<><FileEdit className={iconClass("text-red-600", isActive)} />Admin Pedidos</>)}
      </NavLink>
      <NavLink to="/dashboard/reativar-pedidos" className={navLinkClass}>
        {({ isActive }) => (<><RefreshCw className={iconClass("text-green-600", isActive)} />Reativar Pedidos</>)}
      </NavLink>
      <NavLink to="/dashboard/cleanup-orders" className={navLinkClass}>
        {({ isActive }) => (<><Trash2 className={iconClass("text-red-500", isActive)} />Limpeza de Pedidos</>)}
      </NavLink>
      <NavLink to="/dashboard/settings" className={navLinkClass}>
        {({ isActive }) => (<><Settings className={iconClass("text-gray-600", isActive)} />Configurações</>)}
      </NavLink>
      <NavLink to="/dashboard/integrations" className={navLinkClass}>
        {({ isActive }) => (<><Webhook className={iconClass("text-gray-600", isActive)} />Integrações</>)}
      </NavLink>
      <NavLink to="/dashboard/n8n-integration" className={navLinkClass}>
        {({ isActive }) => (<><Zap className={iconClass("text-gray-500", isActive)} />N8N</>)}
      </NavLink>
      <NavLink to="/dashboard/incoming-webhooks" className={navLinkClass}>
        {({ isActive }) => (<><Webhook className={iconClass("text-gray-500", isActive)} />Webhooks</>)}
      </NavLink>
      <NavLink to="/dashboard/secrets" className={navLinkClass}>
        {({ isActive }) => (<><KeyRound className={iconClass("text-gray-600", isActive)} />Secrets</>)}
      </NavLink>
      <NavLink to="/dashboard/cloudinary-stats" className={navLinkClass}>
        {({ isActive }) => (<><Cloud className={iconClass("text-sky-500", isActive)} />Cloudinary Stats</>)}
      </NavLink>
      <NavLink to="/dashboard/crypto" className={navLinkClass}>
        {({ isActive }) => (<><KeyRound className={iconClass("text-yellow-600", isActive)} />Crypto</>)}
      </NavLink>
      <NavLink to="/dashboard/xk9-relatorio-financeiro" className={navLinkClass}>
        {({ isActive }) => (<><FileSearch className={iconClass("text-emerald-600", isActive)} />Relatório Financeiro</>)}
      </NavLink>
      <NavLink to="/dashboard/relatorio-entrada-estoque" className={navLinkClass}>
        {({ isActive }) => (<><FileDown className={iconClass("text-blue-600", isActive)} />Relatório Entrada Estoque</>)}
      </NavLink>
    </>
  ) : (
    <>
      {/* OPERAÇÃO */}
      <p className={sectionTitleClass}>Operação</p>
      <NavLink to="/dashboard/orders" className={navLinkClass}>
        {({ isActive }) => (<><DollarSign className={iconClass("text-green-600", isActive)} />Pedidos (Clientes)</>)}
      </NavLink>
      <NavLink to="/dashboard/donations" className={navLinkClass}>
        {({ isActive }) => (<><Heart className={iconClass("text-rose-600", isActive)} />Doações</>)}
      </NavLink>
      <NavLink to="/dashboard/products" className={navLinkClass}>
        {({ isActive }) => (<><Package className={iconClass("text-blue-600", isActive)} />Produtos</>)}
      </NavLink>
      <NavLink to="/dashboard/reviews" className={navLinkClass}>
        {({ isActive }) => (<><Star className={iconClass("text-yellow-500", isActive)} />Avaliações</>)}
      </NavLink>
      <NavLink to="/dashboard/shipping-rates" className={navLinkClass}>
        {({ isActive }) => (<><Bike className={iconClass("text-indigo-600", isActive)} />Fretes e Taxa</>)}
      </NavLink>

      {/* CLIENTES */}
      <p className={sectionTitleClass}>Clientes</p>
      <NavLink to="/dashboard/clients" className={navLinkClass}>
        {({ isActive }) => (<><Users className={iconClass("text-cyan-600", isActive)} />Base de Clientes</>)}
      </NavLink>
      <NavLink to="/dashboard/cadastrar-cliente" className={navLinkClass}>
        {({ isActive }) => (<><UserPlus className={iconClass("text-cyan-600", isActive)} />Cadastrar Cliente</>)}
      </NavLink>

      {/* FIDELIDADE & PROMOÇÕES */}
      <p className={sectionTitleClass}>Fidelidade & Promoções</p>
      <NavLink to="/dashboard/club-dk" className={navLinkClass}>
        {({ isActive }) => (<><Crown className={iconClass("text-pink-600", isActive)} />Club DK Fidelidade</>)}
      </NavLink>
      <NavLink to="/dashboard/loyalty-management" className={navLinkClass}>
        {({ isActive }) => (<><Gift className={iconClass("text-pink-500", isActive)} />Gestão de Fidelidade</>)}
      </NavLink>
      <NavLink to="/dashboard/user-coupons-history" className={navLinkClass}>
        {({ isActive }) => (<><TicketCheck className={iconClass("text-pink-600", isActive)} />Histórico de Cupons</>)}
      </NavLink>
      <NavLink to="/dashboard/coupon-management" className={navLinkClass}>
        {({ isActive }) => (<><Ticket className={iconClass("text-pink-500", isActive)} />Gestão de Cupons</>)}
      </NavLink>
      <NavLink to="/dashboard/promotions" className={navLinkClass}>
        {({ isActive }) => (<><Percent className={iconClass("text-pink-600", isActive)} />Kits & Promoções</>)}
      </NavLink>
      <NavLink to="/dashboard/coupons" className={navLinkClass}>
        {({ isActive }) => (<><Ticket className={iconClass("text-pink-600", isActive)} />Cupons</>)}
      </NavLink>
      <NavLink to="/dashboard/manual-add-points" className={navLinkClass}>
        {({ isActive }) => (<><Gift className={iconClass("text-pink-400", isActive)} />Pontos Manual</>)}
      </NavLink>

      {/* ADMINISTRAÇÃO */}
      <p className={sectionTitleClass}>Administração</p>
      <NavLink to="/dashboard/user-admin" className={navLinkClass}>
        {({ isActive }) => (<><ShieldAlert className={iconClass("text-red-600", isActive)} />Admin Usuários</>)}
      </NavLink>
      <NavLink to="/dashboard/investigar-usuario" className={navLinkClass}>
        {({ isActive }) => (<><Search className={iconClass("text-orange-600", isActive)} />Investigar Usuário</>)}
      </NavLink>
      <NavLink to="/dashboard/order-admin" className={navLinkClass}>
        {({ isActive }) => (<><FileEdit className={iconClass("text-red-600", isActive)} />Admin Pedidos</>)}
      </NavLink>
      <NavLink to="/dashboard/reativar-pedidos" className={navLinkClass}>
        {({ isActive }) => (<><RefreshCw className={iconClass("text-green-600", isActive)} />Reativar Pedidos</>)}
      </NavLink>
    </>
  );

  const sidebarContent = (
    <>
      <div className="p-6 pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-gray-900">
          <Box className="w-8 h-8 fill-primary text-primary" />
          Tabacaria
        </h1>
        <button
          className="lg:hidden p-1 rounded-lg hover:bg-gray-200 text-gray-500"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {isAdmin && (
        <span className="mx-6 mt-1 mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider">
          <ShieldAlert className="w-3 h-3" />
          Administrador
        </span>
      )}

      {isGerenteGeral && !isAdmin && (
        <span className="mx-6 mt-1 mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
          <Crown className="w-3 h-3" />
          Gerente Geral
        </span>
      )}

      {isGerente && !isAdmin && !isGerenteGeral && (
        <span className="mx-6 mt-1 mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wider">
          <Crown className="w-3 h-3" />
          Gerente Logística
        </span>
      )}

      {isLogistica && !isGerente && !isAdmin && (
        <span className="mx-6 mt-1 mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider">
          <TruckIcon className="w-3 h-3" />
          Logística
        </span>
      )}

      <nav className="flex-1 overflow-y-auto px-3 pb-6 space-y-1 custom-scrollbar">
        {isFullAccess ? (
          fullMenu
        ) : isLogistica ? (
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
            <p className={sectionTitleClass}>Visão Geral</p>
            <NavLink to="/dashboard" end className={navLinkClass}>
              {({ isActive }) => (<><Home className={iconClass("text-slate-500", isActive)} />Dashboard</>)}
            </NavLink>
            <NavLink to="/dashboard/analytics" className={navLinkClass}>
              {({ isActive }) => (<><BarChart3 className={iconClass("text-slate-500", isActive)} />Analytics</>)}
            </NavLink>
          </>
        )}
      </nav>

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
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

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