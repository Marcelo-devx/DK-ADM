import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useUser } from "@/hooks/useUser";
import { SessionContextProvider } from "./components/SessionContextProvider";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ProductDetail from "./pages/ProductDetail";
import MyOrders from "./pages/MyOrders";
import MyProfile from "./pages/MyProfile";
import ClubDK from "./pages/ClubDK";
import NotFound from "./pages/NotFound";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import Dashboard from "./pages/dashboard/Dashboard";
import Products from "./pages/dashboard/Products";
import Orders from "./pages/dashboard/Orders";
import Clients from "./pages/dashboard/Clients";
import CadastrarCliente from "./pages/dashboard/CadastrarCliente";
import Categories from "./pages/dashboard/Categories";
import Brands from "./pages/dashboard/Brands";
import SubCategories from "./pages/dashboard/SubCategories";
import Flavors from "./pages/dashboard/Flavors";
import HeroSlides from "./pages/dashboard/HeroSlides";
import HomeContent from "./pages/dashboard/HomeContent";
import Popups from "./pages/dashboard/Popups";
import SalesPopups from "./pages/dashboard/SalesPopups";
import Reviews from "./pages/dashboard/Reviews";
import Coupons from "./pages/dashboard/Coupons";
import Promotions from "./pages/dashboard/Promotions";
import SupplierOrders from "./pages/dashboard/SupplierOrders";
import Settings from "./pages/dashboard/Settings";
import Integrations from "./pages/dashboard/Integrations";
import N8nIntegration from "./pages/dashboard/N8nIntegration";
import IncomingWebhooks from "./pages/dashboard/IncomingWebhooks";
import Secrets from "./pages/dashboard/Secrets";
import CloudinaryStats from "./pages/dashboard/CloudinaryStats";
import Analytics from "./pages/dashboard/Analytics";
import MetaflowInsights from "./pages/dashboard/MetaflowInsights";
import PriceManagement from "./pages/dashboard/PriceManagement";
import ImportClients from "./pages/dashboard/ImportClients";
import ShippingRates from "./pages/dashboard/ShippingRates";
import PrintLabels from "./pages/dashboard/PrintLabels";
import Donations from "./pages/dashboard/Donations";
import Crypto from "./pages/dashboard/Crypto";
import LoyaltyManagement from "./pages/dashboard/LoyaltyManagement";
import UserCouponsHistory from "./pages/dashboard/UserCouponsHistory";
import CouponManagement from "./pages/dashboard/CouponManagement";
import DeliveryRoutes from "./pages/dashboard/DeliveryRoutes";
import SpokeExport from "./pages/dashboard/SpokeExport";
import ClubDKAdmin from "./pages/dashboard/ClubDKAdmin";
import CircuitIntegration from "./pages/dashboard/CircuitIntegration";
import BulkAddPoints from "./pages/dashboard/BulkAddPoints";
import ManualAddPoints from "./pages/dashboard/ManualAddPoints";
import UserAdmin from "./pages/dashboard/UserAdmin";
import OrderAdmin from "./pages/dashboard/OrderAdmin";
import CleanupOrders from "./pages/dashboard/CleanupOrders";
import RelatorioFinanceiro from "./pages/dashboard/RelatorioFinanceiro";
import RelatorioEntradaEstoque from "./pages/dashboard/RelatorioEntradaEstoque";
import InvestigarUsuario from "./pages/dashboard/InvestigarUsuario";
import ReativarPedidos from "./pages/dashboard/ReativarPedidos";

const DashboardIndex = () => {
  const { isGerente, isGerenteGeral, isAdmin, isCatalogo, loading } = useUser();
  if (loading) return null;
  if (isCatalogo) return <Navigate to="/dashboard/products" replace />;
  if (isGerente && !isGerenteGeral && !isAdmin) return <Navigate to="/dashboard/orders" replace />;
  return <Dashboard />;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 1000 * 60 * 5, // 5 minutos - evita refetch desnecessário
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SessionContextProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/meus-pedidos" element={<MyOrders />} />
            <Route path="/meu-perfil" element={<MyProfile />} />
            <Route path="/club-dk" element={<ClubDK />} />
            
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardIndex />} />
              <Route path="products" element={<Products />} />
              <Route path="orders" element={<Orders />} />
              <Route path="clients" element={<Clients />} />
              <Route path="cadastrar-cliente" element={<CadastrarCliente />} />
              <Route path="categories" element={<Categories />} />
              <Route path="brands" element={<Brands />} />
              <Route path="sub-categories" element={<SubCategories />} />
              <Route path="flavors" element={<Flavors />} />
              <Route path="hero-slides" element={<HeroSlides />} />
              <Route path="home-content" element={<HomeContent />} />
              <Route path="popups" element={<Popups />} />
              <Route path="sales-popups" element={<SalesPopups />} />
              <Route path="reviews" element={<Reviews />} />
              <Route path="coupons" element={<Coupons />} />
              <Route path="promotions" element={<Promotions />} />
              <Route path="supplier-orders" element={<SupplierOrders />} />
              <Route path="settings" element={<Settings />} />
              <Route path="spoke-integration" element={<CircuitIntegration />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="n8n-integration" element={<N8nIntegration />} />
              <Route path="incoming-webhooks" element={<IncomingWebhooks />} />
              <Route path="secrets" element={<Secrets />} />
              <Route path="cloudinary-stats" element={<CloudinaryStats />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="metaflow-insights" element={<MetaflowInsights />} />
              <Route path="price-management" element={<PriceManagement />} />
              <Route path="import-clients" element={<ImportClients />} />
              <Route path="shipping-rates" element={<ShippingRates />} />
              <Route path="print-labels" element={<PrintLabels />} />
              <Route path="donations" element={<Donations />} />
              <Route path="crypto" element={<Crypto />} />
              <Route path="loyalty-management" element={<LoyaltyManagement />} />
              <Route path="club-dk" element={<ClubDKAdmin />} />
              <Route path="user-coupons-history" element={<UserCouponsHistory />} />
              <Route path="coupon-management" element={<CouponManagement />} />
              <Route path="delivery-routes" element={<DeliveryRoutes />} />
              <Route path="spoke-export" element={<SpokeExport />} />
              <Route path="bulk-add-points" element={<BulkAddPoints />} />
              <Route path="manual-add-points" element={<ManualAddPoints />} />
              <Route path="user-admin" element={<UserAdmin />} />
              <Route path="order-admin" element={<OrderAdmin />} />
              <Route path="cleanup-orders" element={<CleanupOrders />} />
              <Route path="xk9-relatorio-financeiro" element={<RelatorioFinanceiro />} />
              <Route path="relatorio-entrada-estoque" element={<RelatorioEntradaEstoque />} />
              <Route path="investigar-usuario" element={<InvestigarUsuario />} />
              <Route path="reativar-pedidos" element={<ReativarPedidos />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;