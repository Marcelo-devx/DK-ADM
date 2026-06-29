import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { KeyRound, RefreshCw, Copy, CheckCheck, ShieldAlert, Hash, Link } from "lucide-react";
import { toast } from "sonner";

const APP_URL = window.location.origin;

const SUPABASE_URL = "https://jrlozhhvwqfmjtkmvukf.supabase.co";

export default function AdminAcessoManual() {
  // Aba 1 - Código OTP
  const [emailOtp, setEmailOtp] = useState("");
  const [loadingOtp, setLoadingOtp] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<{ code: string; expires_at: string } | null>(null);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Aba 2 - Nova senha
  const [emailPass, setEmailPass] = useState("");
  const [loadingPass, setLoadingPass] = useState(false);
  const [generatedPass, setGeneratedPass] = useState<string | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const handleGenerateOtp = async () => {
    if (!emailOtp.trim()) {
      toast.error("Informe o e-mail do usuário");
      return;
    }
    setLoadingOtp(true);
    setGeneratedOtp(null);
    setCopiedOtp(false);

    try {
      const token = await getToken();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-generate-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: emailOtp.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar código");

      setGeneratedOtp({ code: data.code, expires_at: data.expires_at });
      toast.success("Código gerado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro inesperado");
    } finally {
      setLoadingOtp(false);
    }
  };

  const handleGeneratePassword = async () => {
    if (!emailPass.trim()) {
      toast.error("Informe o e-mail do usuário");
      return;
    }
    setLoadingPass(true);
    setGeneratedPass(null);
    setCopiedPass(false);

    try {
      const token = await getToken();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-generate-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: emailPass.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar senha");

      setGeneratedPass(data.password);
      toast.success("Nova senha definida com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro inesperado");
    } finally {
      setLoadingPass(false);
    }
  };

  const copyToClipboard = (text: string, type: "otp" | "pass" | "link") => {
    navigator.clipboard.writeText(text);
    if (type === "otp") {
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2000);
    } else if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
    toast.success("Copiado!");
  };

  const getVerifyLink = (email: string) =>
    `${APP_URL}/verificar-acesso?email=${encodeURIComponent(email.trim().toLowerCase())}`;

  const formatExpiry = (isoDate: string) => {
    return new Date(isoDate).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-red-100">
          <ShieldAlert className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Acesso Manual</h1>
          <p className="text-sm text-slate-500">
            Gere credenciais de acesso sem depender do e-mail — plano B para falhas no Resend.
          </p>
        </div>
      </div>

      {/* Aviso */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
        <span>
          Use somente quando o envio por e-mail estiver falhando. Passe as credenciais pelo canal seguro
          (WhatsApp, telefone, etc.) e oriente o usuário a trocar a senha logo após o acesso.
        </span>
      </div>

      <Tabs defaultValue="otp">
        <TabsList className="w-full">
          <TabsTrigger value="otp" className="flex-1 flex items-center gap-2">
            <Hash className="w-4 h-4" />
            Código de Acesso (6 dígitos)
          </TabsTrigger>
          <TabsTrigger value="password" className="flex-1 flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            Nova Senha
          </TabsTrigger>
        </TabsList>

        {/* ABA 1 — OTP */}
        <TabsContent value="otp" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gerar Código de 6 Dígitos</CardTitle>
              <CardDescription>
                Funciona para <strong>criar conta</strong> ou <strong>entrar</strong> — mesmo fluxo da tela de login.
                O código expira em <strong>10 minutos</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  E-mail do usuário
                </label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="cliente@email.com"
                    value={emailOtp}
                    onChange={(e) => {
                      setEmailOtp(e.target.value);
                      setGeneratedOtp(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleGenerateOtp()}
                  />
                  <Button onClick={handleGenerateOtp} disabled={loadingOtp} className="shrink-0">
                    {loadingOtp ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      "Gerar"
                    )}
                  </Button>
                </div>
              </div>

              {generatedOtp && (
                <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 text-center space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Código gerado — passe para o cliente
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-5xl font-black tracking-[12px] text-slate-900">
                      {generatedOtp.code}
                    </span>
                    <button
                      onClick={() => copyToClipboard(generatedOtp.code, "otp")}
                      className="p-2 rounded-lg hover:bg-primary/10 transition-colors"
                      title="Copiar código"
                    >
                      {copiedOtp ? (
                        <CheckCheck className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5 text-slate-500" />
                      )}
                    </button>
                  </div>
                  <div className="flex justify-center gap-2">
                    <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                      Expira às {formatExpiry(generatedOtp.expires_at)}
                    </Badge>
                    <Badge variant="outline" className="text-slate-600">
                      Válido por 10 min
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400">
                    Envie o código <strong>e o link abaixo</strong> para o cliente pelo WhatsApp.
                  </p>

                  {/* Link copiável */}
                  <div className="bg-white border border-slate-200 rounded-lg p-3 text-left space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      <Link className="w-3 h-3" />
                      Link para o cliente acessar a tela do código
                    </p>
                    <p className="text-xs text-slate-600 break-all font-mono bg-slate-50 p-2 rounded">
                      {getVerifyLink(emailOtp)}
                    </p>
                    <button
                      onClick={() => copyToClipboard(getVerifyLink(emailOtp), "link")}
                      className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      {copiedLink ? (
                        <><CheckCheck className="w-3 h-3 text-green-600" /> Link copiado!</>
                      ) : (
                        <><Copy className="w-3 h-3" /> Copiar link</>
                      )}
                    </button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateOtp}
                    className="w-full"
                    disabled={loadingOtp}
                  >
                    <RefreshCw className="w-3 h-3 mr-2" />
                    Gerar novo código
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 2 — NOVA SENHA */}
        <TabsContent value="password" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gerar Nova Senha Temporária</CardTitle>
              <CardDescription>
                Redefine a senha do usuário — mesmo fluxo de <strong>"Esqueceu sua senha?"</strong>.
                A nova senha entra em vigor imediatamente. Oriente o cliente a trocá-la após o acesso.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  E-mail do usuário
                </label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="cliente@email.com"
                    value={emailPass}
                    onChange={(e) => {
                      setEmailPass(e.target.value);
                      setGeneratedPass(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleGeneratePassword()}
                  />
                  <Button onClick={handleGeneratePassword} disabled={loadingPass} className="shrink-0">
                    {loadingPass ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      "Gerar"
                    )}
                  </Button>
                </div>
              </div>

              {generatedPass && (
                <div className="rounded-xl border-2 border-green-200 bg-green-50 p-5 text-center space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Nova senha definida — passe para o cliente
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-3xl font-black tracking-widest text-slate-900 font-mono">
                      {generatedPass}
                    </span>
                    <button
                      onClick={() => copyToClipboard(generatedPass, "pass")}
                      className="p-2 rounded-lg hover:bg-green-100 transition-colors"
                      title="Copiar senha"
                    >
                      {copiedPass ? (
                        <CheckCheck className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5 text-slate-500" />
                      )}
                    </button>
                  </div>
                  <Badge variant="outline" className="text-green-700 border-green-300 bg-green-100">
                    Senha ativa imediatamente
                  </Badge>
                  <p className="text-xs text-slate-400">
                    O cliente usa esta senha para entrar e deve trocá-la em seguida.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGeneratePassword}
                    className="w-full"
                    disabled={loadingPass}
                  >
                    <RefreshCw className="w-3 h-3 mr-2" />
                    Gerar nova senha
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
