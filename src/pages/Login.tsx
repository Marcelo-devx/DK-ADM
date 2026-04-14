import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/components/SessionContextProvider";
import { useEffect } from "react";
import { Box, ShieldCheck, Smartphone } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const session = useSession();

  useEffect(() => {
    if (session) {
      navigate("/");
    }
  }, [session, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <div className="hidden lg:flex lg:w-1/2 bg-[#0B1221] relative items-center justify-center overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/10 to-transparent z-0" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/4 right-10 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl" />

        <div className="relative z-10 p-12 text-center max-w-lg">
          <div className="w-20 h-20 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-blue-500/30 shadow-xl shadow-blue-900/20">
            <Box className="w-10 h-10 text-blue-500" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
            Gerencie sua Tabacaria com <span className="text-blue-500">Excelência</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Controle total sobre estoque, pedidos, clientes e logística em uma única plataforma integrada.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-12">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden rounded-3xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Box className="h-7 w-7" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Bem-vindo de volta!</h2>
              <p className="text-sm text-slate-500">
                Faça login para acessar o painel administrativo.
              </p>
            </div>
          </div>

          <div className="hidden lg:block text-center lg:text-left space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Bem-vindo de volta!</h2>
            <p className="text-sm text-gray-500">
              Faça login para acessar o painel administrativo.
            </p>
          </div>

          <div className="rounded-3xl bg-white p-4 sm:p-6 shadow-xl border border-slate-200">
            <Auth
              supabaseClient={supabase}
              appearance={{ theme: ThemeSupa }}
              theme="light"
              providers={[]}
            />
          </div>

          <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Acesso restrito e seguro
          </div>

          <p className="text-center text-xs text-gray-400 pt-2">
            &copy; {new Date().getFullYear()} Sistema de Gestão. Acesso Restrito.
          </p>
        </div>
      </div>
    </div>
  );
}