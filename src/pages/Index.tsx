import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useUser } from "@/hooks/useUser";

const Index = () => {
  const { user, isAdmin, loading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading || !user) {
    return null; // ou um componente de loading
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 relative">
      <div className="text-center p-8">
        <h1 className="text-4xl font-bold mb-4">
          Bem-vindo, {user.email}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
          Você está logado com sucesso!
        </p>
        <div className="space-x-4">
          {isAdmin && (
            <Button asChild>
              <Link to="/dashboard">Acessar Painel</Link>
            </Button>
          )}
          <Button onClick={handleLogout} variant="outline">Sair</Button>
        </div>
      </div>
    </div>
  );
};

export default Index;