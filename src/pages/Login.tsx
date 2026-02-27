import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/components/SessionContextProvider";
import { useEffect } from "react";
import { Box } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const session = useSession();

  useEffect(() => {
    if (session) {
      // Usando um recarregamento completo da página para garantir que a sessão seja reavaliada.
      window.location.href = "/";
    }
  }, [session]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Lado Esquerdo - Visual/Marketing (Visível apenas em telas grandes) */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0B1221] relative items-center justify-center overflow-hidden">
        {/* Efeitos de fundo */}
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

      {/* Lado Direito - Formulário */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-12 bg-white lg:bg-transparent">
        <div className="w-full max-w-sm space-y-8">
            <div className="text-center lg:text-left">
                <div className="lg:hidden w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Box className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900">Bem-vindo de volta!</h2>
                <p className="text-sm text-gray-500 mt-2">
                    Faça login para acessar o painel administrativo.
                </p>
            </div>

            <div className="bg-white p-2 lg:p-0 rounded-xl">
                <Auth
                    supabaseClient={supabase}
                    appearance={{ theme: ThemeSupa }}
                    theme="light"
                    providers={[]}
                />
            </div>
            
            <p className="text-center text-xs text-gray-400 pt-8 border-t border-gray-100 mt-8">
                &copy; {new Date().getFullYear()} Sistema de Gestão. Acesso Restrito.
            </p>
        </div>
      </div>
    </div>
  );
}