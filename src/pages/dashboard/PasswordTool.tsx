"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

const PasswordToolPage = () => {
  const [email, setEmail] = useState("coo@spaceshipnft.com");
  const [newPassword, setNewPassword] = useState("102030@");

  const setPasswordMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-set-password", {
        body: { email, new_password: newPassword },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      showSuccess(data.message);
    },
    onError: (error: Error) => {
      showError(`Erro: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !newPassword) {
      showError("Preencha todos os campos.");
      return;
    }
    setPasswordMutation.mutate();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-orange-500" />
            Ferramenta de Alteração de Senha
          </CardTitle>
          <CardDescription>
            Use esta ferramenta para definir uma nova senha para qualquer usuário do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email do Usuário</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input
                id="new-password"
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nova senha forte"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={setPasswordMutation.isPending}>
              {setPasswordMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Alterar Senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordToolPage;