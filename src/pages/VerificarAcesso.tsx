import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, RotateCcw, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const SUPABASE_URL = "https://jrlozhhvwqfmjtkmvukf.supabase.co";

export default function VerificarAcesso() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const email = searchParams.get("email") ?? "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      setError("Digite os 6 dígitos do código.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          redirect_to: window.location.origin + "/meus-pedidos",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Código inválido. Tente novamente.");
        return;
      }

      setSuccess(true);

      // Redireciona para o magic link que loga o usuário automaticamente
      setTimeout(() => {
        window.location.href = data.action_link;
      }, 800);

    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #f5f0e8 0%, #ede8df 100%)" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1">
            <span className="text-3xl font-black tracking-tight text-slate-900">DKCWB</span>
            <span className="text-3xl font-black text-sky-500">.</span>
          </div>
          <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase mt-1">
            Acesso Exclusivo
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">

          {/* Ícone */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-sky-50 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-sky-500" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-lg">Digite seu código</h2>
              <p className="text-sm text-slate-500 mt-1">
                Insira o código de <strong>6 dígitos</strong> que você recebeu.
              </p>
              {email && (
                <p className="text-xs text-slate-400 mt-1 break-all">
                  {email}
                </p>
              )}
            </div>
          </div>

          {/* Input do código */}
          <div className="space-y-3">
            <Input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleVerify()}
              className="text-center text-2xl font-bold tracking-[0.4em] h-14 border-slate-200"
              disabled={loading || success}
            />

            {error && (
              <p className="text-sm text-red-600 text-center flex items-center justify-center gap-1">
                <span>⚠</span> {error}
              </p>
            )}
          </div>

          {/* Botão */}
          <Button
            className="w-full h-12 text-sm font-bold uppercase tracking-wide"
            onClick={handleVerify}
            disabled={loading || success || code.length !== 6}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : success ? (
              <><ShieldCheck className="w-4 h-4 mr-2" /> Entrando...</>
            ) : (
              "Confirmar código"
            )}
          </Button>

          {/* Voltar */}
          <button
            onClick={() => navigate(-1)}
            className="w-full flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors pt-1"
          >
            <ArrowLeft className="w-3 h-3" />
            Voltar ao início
          </button>
        </div>

        {/* Aviso de expiração */}
        <div className="text-center mt-4 flex items-center justify-center gap-1 text-xs text-slate-400">
          <RotateCcw className="w-3 h-3" />
          O código expira em 10 minutos
        </div>
      </div>
    </div>
  );
}
