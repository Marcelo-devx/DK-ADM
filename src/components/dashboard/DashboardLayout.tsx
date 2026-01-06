import { Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useUser } from "../../hooks/useUser";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { FirstOrdersDisplay } from "./FirstOrdersDisplay";

const DashboardLayout = () => {
  const { loading, isAdmin, user } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/login");
      } else if (!isAdmin) {
        // Se não for admin, redireciona para a página inicial ou uma página de acesso negado.
        navigate("/");
      }
    }
  }, [loading, isAdmin, user, navigate]);

  if (loading || !isAdmin) {
    // Mostra uma tela de carregamento ou nulo enquanto verifica a autenticação e permissão
    return (
      <div className="flex items-center justify-center h-screen">
        Carregando...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <FirstOrdersDisplay />
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