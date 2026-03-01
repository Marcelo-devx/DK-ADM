import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SessionContextProvider } from "./components/SessionContextProvider";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ProductDetail from "./pages/ProductDetail";
import MyOrders from "./pages/MyOrders";
import MyProfile from "./pages/MyProfile";
import ClubDK from "./pages/ClubDK";
import CheckoutPage from "./pages/Checkout";
import NotFound from "./pages/NotFound";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import Dashboard from "./pages/dashboard/Dashboard";
import Products from "./pages/dashboard/Products";
import Orders from "./pages/dashboard/Orders";
import Clients from "./pages/dashboard/Clients";
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
import DeliveryRoutes from "./pages/dashboard/DeliveryRoutes";
import SpokeExport from "./pages/dashboard/SpokeExport";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route path="/my-profile" element={<MyProfile />} />
            <Route path="/club-dk" element={<ClubDK />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="orders" element={<Orders />} />
              <Route path="clients" element={<Clients />} />
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
              <Route path="user-coupons-history" element={<UserCouponsHistory />} />
              <Route path="delivery-routes" element={<DeliveryRoutes />} />
              <Route path="spoke-export" element={<SpokeExport />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;