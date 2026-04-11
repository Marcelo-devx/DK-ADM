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

  const isGerenteGeralView = isGerenteGeral && !isAdmin;

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

      {isGerenteGeralView && (
        <span className="mx-6 mt-1 mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
          <Crown className="w-3 h-3" />
          Gerente Geral
        </span>
      )}

      {isGerente && !isAdmin && !isGerenteGeralView && (
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
        {isGerenteGeralView ? (
          <>
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
            <NavLink to="/dashboard/shipping-rates" className={navLinkClass}>
              {({ isActive }) => (<><Bike className={iconClass("text-indigo-600", isActive)} />Fretes e Taxa</>)}
            </NavLink>

            <p className={sectionTitleClass}>Clientes</p>
            <NavLink to="/dashboard/clients" className={navLinkClass}>
              {({ isActive }) => (<><Users className={iconClass("text-cyan-600", isActive)} />Base de Cliente</>)}
            </NavLink>
            <NavLink to="/dashboard/cadastrar-cliente" className={navLinkClass}>
              {({ isActive }) => (<><UserPlus className={iconClass("text-cyan-600", isActive)} />Cadastrar Cliente</>)}
            </NavLink>

            <p className={sectionTitleClass}>Fidelidade & Promoções</p>
            <NavLink to="/dashboard/club-dk" className={navLinkClass}>
              {({ isActive }) => (<><Crown className={iconClass("text-pink-600", isActive)} />Club DK Fidelidade</>)}
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

            <p className={sectionTitleClass}>Administração</p>
            <NavLink to="/dashboard/user-admin" className={navLinkClass}>
              {({ isActive }) => (<><ShieldAlert className={iconClass("text-red-600", isActive)} />Admin Usuários</>)}
            </NavLink>
            <NavLink to="/dashboard/order-admin" className={navLinkClass}>
              {({ isActive }) => (<><FileEdit className={iconClass("text-red-600", isActive)} />Admin Pedidos</>)}
            </NavLink>
          </>
        ) : isLogistica && !isAdmin ? (
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