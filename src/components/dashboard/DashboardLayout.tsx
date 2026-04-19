import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useCallback, useState, createContext, useContext } from "react";
import { useUser } from "../../hooks/useUser";
import { useSession } from "@/components/SessionContextProvider";
import Sidebar from "./Sidebar";
import Header from "./Header";

const OPERACIONAL_ALLOWED_ROUTES = [
  "/dashboard/orders",
  "/dashboard/donations",
  "/dashboard/products",
  "/dashboard/price-management",
  "/dashboard/clients",
  "/dashboard/cadastrar-cliente",
  "/dashboard/club-dk",
  "/dashboard/user-coupons-history",
  "/dashboard/promotions",
  "/dashboard/coupons",
  "/dashboard/user-admin",
  "/dashboard/order-admin",
  "/dashboard/shipping-rates",
  "/dashboard/spoke-export",
  "/dashboard/print-labels",
  "/dashboard/delivery-routes",
];

const GERENTE_GERAL_ALLOWED_ROUTES = [
  "/dashboard/orders",
  "/dashboard/donations",
  "/dashboard/products",
  "/dashboard/reviews",
  "/dashboard/shipping-rates",
  "/dashboard/clients",
  "/dashboard/cadastrar-cliente",
  "/dashboard/club-dk",
  "/dashboard/loyalty-management",
  "/dashboard/user-coupons-history",
  "/dashboard/coupon-management",
  "/dashboard/promotions",
  "/dashboard/coupons",
  "/dashboard/manual-add-points",
  "/dashboard/user-admin",
  "/dashboard/investigar-usuario",
  "/dashboard/order-admin",
  "/dashboard/reativar-pedidos",
];

const CATALOGO_ALLOWED_ROUTES = [
  "/dashboard/products",
];

interface SidebarContextType {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  sidebarOpen: false,
  setSidebarOpen: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

const DashboardLayout = () => {
  const { loading, isAdmin, isLogistica, isGerente, isGerenteGeral, isCatalogo, user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sessionAccessToken = session?.access_token;

  const checkAuth = useCallback(() => {
    if (!loading && session !== undefined) {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      if (!isAdmin && !isLogistica && !isGerente && !isGerenteGeral && !isCatalogo) {
        navigate("/", { replace: true });
        return;
      }

      if (isCatalogo && !isAdmin) {
        const currentPath = location.pathname;
        const isAllowed = CATALOGO_ALLOWED_ROUTES.some((r) => currentPath.startsWith(r));
        if (!isAllowed) {
          navigate("/dashboard/products", { replace: true });
          return;
        }
      }

      if (isGerenteGeral && !isAdmin) {
        const currentPath = location.pathname;
        const isAllowed =
          currentPath === "/dashboard" ||
          GERENTE_GERAL_ALLOWED_ROUTES.some((r) => currentPath.startsWith(r));
        if (!isAllowed) {
          navigate("/dashboard/orders", { replace: true });
          return;
        }
      }

      if ((isLogistica || isGerente) && !isAdmin && !isGerenteGeral) {
        const currentPath = location.pathname;
        const isAllowed =
          currentPath === "/dashboard" ||
          OPERACIONAL_ALLOWED_ROUTES.some((r) => currentPath.startsWith(r));

        if (!isAllowed) {
          navigate("/dashboard/orders", { replace: true });
          return;
        }
      }
    }
  }, [loading, isAdmin, isLogistica, isGerente, isGerenteGeral, isCatalogo, user?.id, navigate, sessionAccessToken, location.pathname, session]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Carregando...
      </div>
    );
  }

  return (
    <SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="p-4 md:p-6 lg:p-8 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
};

export default DashboardLayout;