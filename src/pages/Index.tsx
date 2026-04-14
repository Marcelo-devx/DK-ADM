import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/hooks/useUser";
import { Loader2, ShieldCheck, Smartphone } from "lucide-react";

const Index = () => {
  const { user, isAdmin, isLogistica, loading } = useUser();
  const navigate = useNavigate();
  const [timeoutError, setTimeoutError] = useState(false);

  useEffect(() => {
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

  if (timeoutError) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white px-4 py-8 flex items-center justify-center">
        <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-xl text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">Tempo limite excedido</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              O carregamento demorou mais do que o esperado. Tente novamente para continuar.
            </p>
          </div>
          <button
            onClick={handleRetry}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-xl text-center space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Smartphone className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900">Carregando acesso</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Estamos preparando sua experiência com segurança.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          Acesso protegido
        </div>
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
      </div>
    </div>
  );
};

export default Index;