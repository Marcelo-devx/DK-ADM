import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/components/SessionContextProvider";
import { useEffect } from "react";
import { Box, LayoutDashboard } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const session = useSession();

  useEffect(() => {
    if (session) {
      navigate("/");
    }
  }, [session, navigate]);

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
                    appearance={{
                        theme: ThemeSupa,
                        variables: {
                            default: {
                                colors: {
                                    brand: '#2563eb', // blue-600
                                    brandAccent: '#1d4ed8', // blue-700
                                    inputBackground: 'white',
                                    inputText: '#1e293b',
                                    inputPlaceholder: '#94a3b8',
                                    inputBorder: '#e2e8f0',
                                    inputBorderFocus: '#2563eb',
                                    inputBorderHover: '#cbd5e1',
                                },
                                borderWidths: {
                                    buttonBorderWidth: '0px',
                                    inputBorderWidth: '1px',
                                },
                                radii: {
                                    borderRadiusButton: '0.5rem',
                                    buttonBorderRadius: '0.5rem',
                                    inputBorderRadius: '0.5rem',
                                },
                                fonts: {
                                    bodyFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
                                    buttonFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
                                }
                            },
                        },
                        className: {
                            container: 'space-y-4',
                            button: 'font-bold h-11 shadow-sm',
                            input: 'font-medium h-11',
                            label: 'font-semibold text-sm text-slate-700 mb-1 block',
                            anchor: 'text-blue-600 hover:text-blue-700 font-medium text-sm'
                        }
                    }}
                    theme="light"
                    providers={[]}
                    localization={{
                        variables: {
                            sign_in: {
                                email_label: "Endereço de e-mail",
                                password_label: "Sua senha",
                                email_input_placeholder: "exemplo@tabacaria.com",
                                password_input_placeholder: "••••••••",
                                button_label: "Acessar Painel",
                                loading_button_label: "Entrando...",
                                link_text: "Já tem uma conta? Entre",
                            },
                            forgotten_password: {
                                link_text: "Esqueceu a senha?",
                                email_label: "E-mail para recuperação",
                                password_label: "Sua senha",
                                email_input_placeholder: "Seu e-mail cadastrado",
                                button_label: "Enviar instruções",
                                loading_button_label: "Enviando...",
                                confirmation_text: "Verifique seu e-mail para o link de recuperação",
                            },
                        },
                    }}
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