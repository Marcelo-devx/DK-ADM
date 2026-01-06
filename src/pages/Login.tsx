import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/components/SessionContextProvider";
import { useEffect } from "react";

export default function LoginPage() {
  const navigate = useNavigate();
  const session = useSession();

  useEffect(() => {
    if (session) {
      navigate("/");
    }
  }, [session, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="w-full max-w-md p-4">
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: "#3b82f6",
                  brandAccent: "#2563eb",
                },
              },
            },
          }}
          theme="dark"
          providers={[]}
          localization={{
            variables: {
              sign_in: {
                email_label: "Endereço de e-mail",
                password_label: "Sua senha",
                email_input_placeholder: "Seu endereço de e-mail",
                password_input_placeholder: "Sua senha",
                button_label: "Entrar",
                social_provider_text: "Entrar com {{provider}}",
                link_text: "Já tem uma conta? Entre",
              },
              sign_up: {
                email_label: "Endereço de e-mail",
                password_label: "Crie uma senha",
                email_input_placeholder: "Seu endereço de e-mail",
                password_input_placeholder: "Crie uma senha",
                button_label: "Cadastre-se",
                link_text: "Não tem uma conta? Cadastre-se",
              },
              forgotten_password: {
                link_text: "Esqueceu sua senha?",
                email_label: "Endereço de e-mail",
                email_input_placeholder: "Seu endereço de e-mail",
                button_label: "Enviar instruções de redefinição de senha",
              },
            },
          }}
        />
      </div>
    </div>
  );
}