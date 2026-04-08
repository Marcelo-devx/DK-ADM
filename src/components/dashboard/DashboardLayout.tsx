import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useCallback } from "react";
import { useUser } from "../../hooks/useUser";
import { useSession } from "@/components/SessionContextProvider";
import Sidebar from "./Sidebar";
import Header from "./Header";

const DashboardLayout = () => {
  const { loading, isAdmin, user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();

  const sessionAccessToken = session?.access_token; // string estável

  const checkAuth = useCallback(() => {
    if (!loading && session !== undefined) {
      if (!user) {
        navigate("/login", { replace: true });
      } else if (!isAdmin) {
        // Se não for admin, redireciona para a página inicial ou uma página de acesso negado.
        navigate("/", { replace: true });
      }
    }
  }, [loading, isAdmin, user?.id, navigate, sessionAccessToken]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loading) {
    // Mostra uma tela de carregamento enquanto verifica a autenticação e permissão
    return (
      <div className="flex items-center justify-center h-screen">
        Carregando...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      {/* Widget removido conforme solicitado */}
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