"use client";

import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/Login";
import { SessionContextProvider } from "./components/SessionContextProvider";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import DashboardPage from "./pages/dashboard/Dashboard";
import ProductsPage from "./pages/dashboard/Products";
import CategoriesPage from "./pages/dashboard/Categories";
import SubCategoriesPage from "./pages/dashboard/SubCategories";
import BrandsPage from "./pages/dashboard/Brands";
import CloudinaryStatsPage from "./pages/dashboard/CloudinaryStats";
import HeroSlidesPage from "./pages/dashboard/HeroSlides";
import PromotionsPage from "./pages/dashboard/Promotions";
import SettingsPage from "./pages/dashboard/Settings";
import PopupsPage from "./pages/dashboard/Popups";
import ClientsPage from "./pages/dashboard/Clients";
import { FaviconManager } from "./components/FaviconManager";
import { InformationalPopup } from "./components/InformationalPopup";
import HomeContentPage from "./pages/dashboard/HomeContent";
import MyOrdersPage from "./pages/MyOrders";
import ReviewsPage from "./pages/dashboard/Reviews";
import ProductDetailPage from "./pages/ProductDetail";
import CouponsPage from "./pages/dashboard/Coupons";
import IntegrationsPage from "./pages/dashboard/Integrations";
import SalesPopupsPage from "./pages/dashboard/SalesPopups";
import { SalesPopupDisplay } from "./components/SalesPopupDisplay";
import FlavorsPage from "./pages/dashboard/Flavors";
import OrdersPage from "./pages/dashboard/Orders";
import SupplierOrdersPage from "./pages/dashboard/SupplierOrders";
import PriceManagementPage from "./pages/dashboard/PriceManagement";
import PrintLabelsPage from "./pages/dashboard/PrintLabels";
import DeliveryRoutesPage from "./pages/dashboard/DeliveryRoutes";
import SpokeExportPage from "./pages/dashboard/SpokeExport";
import SecretsPage from "./pages/dashboard/Secrets";
import ImportClientsPage from "./pages/dashboard/ImportClients";
import N8nIntegrationPage from "./pages/dashboard/N8nIntegration";
import AnalyticsPage from "./pages/dashboard/Analytics";
import MetaflowInsightsPage from "./pages/dashboard/MetaflowInsights";

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();
  const isDashboardOrAuthRoute = 
    location.pathname === '/login' || 
    location.pathname.startsWith('/dashboard');

  return (
    <>
      <InformationalPopup />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/meus-pedidos" element={<MyOrdersPage />} />
        <Route path="/produto/:id" element={<ProductDetailPage />} />
        
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="metaflow" element={<MetaflowInsightsPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="n8n" element={<N8nIntegrationPage />} />
          <Route path="delivery-routes" element={<DeliveryRoutesPage />} />
          <Route path="spoke-export" element={<SpokeExportPage />} />
          <Route path="print-labels" element={<PrintLabelsPage />} />
          <Route path="prices" element={<PriceManagementPage />} />
          <Route path="supplier-orders" element={<SupplierOrdersPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="import-clients" element={<ImportClientsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="sub-categories" element={<SubCategoriesPage />} />
          <Route path="brands" element={<BrandsPage />} />
          <Route path="flavors" element={<FlavorsPage />} />
          <Route path="promotions" element={<PromotionsPage />} />
          <Route path="coupons" element={<CouponsPage />} />
          <Route path="hero-slides" element={<HeroSlidesPage />} />
          <Route path="home-content" element={<HomeContentPage />} />
          <Route path="popups" element={<PopupsPage />} />
          <Route path="sales-popups" element={<SalesPopupsPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="cloudinary-stats" element={<CloudinaryStatsPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="secrets" element={<SecretsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      {!isDashboardOrAuthRoute && <SalesPopupDisplay />}
    </>
  );
};

const App = () => (
  <SessionContextProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <FaviconManager />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </SessionContextProvider>
);

export default App;