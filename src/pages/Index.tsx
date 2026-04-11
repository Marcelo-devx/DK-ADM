import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/hooks/useUser";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, isAdmin, isLogistica, loading } = useUser();
  const navigate = useNavigate();
  const [timeoutError, setTimeoutError] = useState(false);

  useEffect(() => {
    // Timeout de 10 segundos para evitar loading infinito
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.error('[Index] Timeout aguardando carregamento do usuário');
        setTimeoutError(true);
      }
    }, 10000);

    if (!loading) {
      clearTimeout(timeoutId);
    }

    return () => clearTimeout(timeoutId);
  }, [loading]);

  useEffect(() => {
    if (!loading && !timeoutError) {
      if (!user) {
        navigate("/login");
      } else if (isAdmin) {
        navigate("/dashboard");
      } else if (isLogistica) {
        navigate("/dashboard/orders");
      } else {
        navigate("/meus-pedidos");
      }
    }
  }, [user, isAdmin, isLogistica, loading, navigate, timeoutError]);

  const handleRetry = () => {
    setTimeoutError(false);
    window.location.reload();
  };

  // Mostra erro se ocorreu timeout
  if (timeoutError) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">
            <Loader2 className="h-16 w-16 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Tempo limite excedido
          </h2>
          <p className="text-gray-600 mb-4">
            O carregamento está demorando mais do que o esperado. Pode haver um problema com sua conexão ou com a sessão.
          </p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // Mostra loading normal
  return (
    <div className="h-screen w-full flex items-center justify-center bg-gray-50">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default Index;