import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useCallback } from "react";
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

const DashboardLayout = () => {
  const { loading, isAdmin, isLogistica, user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();

  const sessionAccessToken = session?.access_token;

  const checkAuth = useCallback(() => {
    if (!loading && session !== undefined) {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      // Nem admin nem logistica → redireciona para home
      if (!isAdmin && !isLogistica) {
        navigate("/", { replace: true });
        return;
      }

      // Se for logistica, verifica se a rota atual é permitida
      if (isLogistica && !isAdmin) {
        const currentPath = location.pathname;
        // Permite acesso à raiz /dashboard (será redirecionado abaixo)
        const isAllowed =
          currentPath === "/dashboard" ||
          LOGISTICA_ALLOWED_ROUTES.some((r) => currentPath.startsWith(r));

        if (!isAllowed) {
          navigate("/dashboard/orders", { replace: true });
          return;
        }

        // Redireciona /dashboard raiz para /dashboard/orders
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
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
