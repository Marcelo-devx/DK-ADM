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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-black/20 p-8 sm:p-10">
          <div className="flex flex-col items-center text-center gap-4 mb-8">
            <div className="h-20 w-20 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center shadow-sm overflow-hidden">
              <img src="/favicon.ico" alt="DON DK" className="h-12 w-12 object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">DON DK</h1>
              <p className="text-sm text-slate-500 mt-1">Acesso administrativo</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 sm:p-6 border border-slate-200 shadow-sm">
            <Auth
              supabaseClient={supabase}
              appearance={{ theme: ThemeSupa }}
              theme="light"
              providers={[]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
