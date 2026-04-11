import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useCallback, useState, createContext, useContext } from "react";
import { useUser } from "../../hooks/useUser";
import { useSession } from "@/components/SessionContextProvider";
import Sidebar from "./Sidebar";
import Header from "./Header";

// Rotas permitidas para o role "logistica"
const LOGISTICA_ALLOWED_ROUTES = [
  "/dashboard/orders",
  "/dashboard/spoke-export",
  "/dashboard/print-labels",
];

// Contexto para controlar abertura da sidebar no mobile
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
  const { loading, isAdmin, isLogistica, user } = useUser();
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

      if (!isAdmin && !isLogistica) {
        navigate("/", { replace: true });
        return;
      }

      if (isLogistica && !isAdmin) {
        const currentPath = location.pathname;
        const isAllowed =
          currentPath === "/dashboard" ||
          LOGISTICA_ALLOWED_ROUTES.some((r) => currentPath.startsWith(r));

        if (!isAllowed) {
          navigate("/dashboard/orders", { replace: true });
          return;
        }

        if (currentPath === "/dashboard") {
          navigate("/dashboard/orders", { replace: true });
        }
      }
    }
  }, [loading, isAdmin, isLogistica, user?.id, navigate, sessionAccessToken, location.pathname]);

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
