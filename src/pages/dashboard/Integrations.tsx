import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { showSuccess, showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Plug } from "lucide-react";

// Schemas
const mercadoPagoFormSchema = z.object({
  accessToken: z.string().min(10, "O Access Token parece ser muito curto."),
});
type MercadoPagoFormValues = z.infer<typeof mercadoPagoFormSchema>;

const pagSeguroFormSchema = z.object({
  email: z.string().email("Por favor, insira um e-mail válido."),
  token: z.string().min(10, "O token parece ser muito curto."),
});
type PagSeguroFormValues = z.infer<typeof pagSeguroFormSchema>;

// Props
type MercadoPagoConnectionCardProps = {
  type: 'production' | 'test';
  title: string;
  description: string;
  credentialsUrl: string;
};

type PagSeguroConnectionCardProps = {
  type: 'production' | 'test';
  title: string;
  description: string;
  credentialsUrl: string;
};

// Components
const MercadoPagoConnectionCard = ({ type, title, description, credentialsUrl }: MercadoPagoConnectionCardProps) => {
  const queryClient = useQueryClient();
  const queryKey = ["mercadopagoStatus", type];

  const { data: status, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-mercadopago-status", {
        body: { type },
      });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const form = useForm<MercadoPagoFormValues>({
    resolver: zodResolver(mercadoPagoFormSchema),
    defaultValues: { accessToken: "" },
  });

  const mutation = useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.functions.invoke("update-mercadopago-token", {
        body: { token, type },
      });
      if (error) {
        if (error.context && typeof error.context.json === 'function') {
            const errorJson = await error.context.json();
            if (errorJson.details) throw new Error(errorJson.details);
        }
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      showSuccess(`Conexão de ${type === 'production' ? 'Produção' : 'Teste'} estabelecida!`);
      form.reset();
    },
    onError: (error: Error) => {
      showError(`Erro na conexão: ${error.message}`);
    },
  });

  const onSubmit = (values: MercadoPagoFormValues) => {
    mutation.mutate(values.accessToken);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-24" />
          ) : status?.connected ? (
            <Badge variant="default" className="bg-green-500 hover:bg-green-600">Conectado</Badge>
          ) : (
            <Badge variant="destructive">Não Conectado</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="accessToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access Token</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Cole seu Access Token aqui" {...field} />
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-muted-foreground pt-1">
                    Você pode encontrar seu token em{" "}
                    <a href={credentialsUrl} target="_blank" rel="noopener noreferrer" className="underline">
                      Credenciais
                    </a> no painel do Mercado Pago.
                  </p>
                </FormItem>
              )}
            />
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Verificando..." : "Salvar e Conectar"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

const PagSeguroConnectionCard = ({ type, title, description, credentialsUrl }: PagSeguroConnectionCardProps) => {
  const queryClient = useQueryClient();
  const queryKey = ["pagseguroStatus", type];

  const { data: status, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-pagseguro-status", {
        body: { type },
      });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const form = useForm<PagSeguroFormValues>({
    resolver: zodResolver(pagSeguroFormSchema),
    defaultValues: { email: "", token: "" },
  });

  const mutation = useMutation({
    mutationFn: async (values: PagSeguroFormValues) => {
      const { data, error } = await supabase.functions.invoke("update-pagseguro-token", {
        body: { ...values, type },
      });
      if (error) {
        if (error.context && typeof error.context.json === 'function') {
            const errorJson = await error.context.json();
            if (errorJson.details) throw new Error(errorJson.details);
        }
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      showSuccess(`Conexão de ${type === 'production' ? 'Produção' : 'Teste'} estabelecida!`);
      form.reset();
    },
    onError: (error: Error) => {
      showError(`Erro na conexão: ${error.message}`);
    },
  });

  const onSubmit = (values: PagSeguroFormValues) => {
    mutation.mutate(values);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-24" />
          ) : status?.connected ? (
            <Badge variant="default" className="bg-green-500 hover:bg-green-600">Conectado</Badge>
          ) : (
            <Badge variant="destructive">Não Conectado</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Seu e-mail do PagSeguro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Token</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Cole seu Token aqui" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="text-sm text-muted-foreground pt-1">
              Você pode encontrar seu token em{" "}
              <a href={credentialsUrl} target="_blank" rel="noopener noreferrer" className="underline">
                Vendedor
              </a> no painel do PagSeguro.
            </p>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Verificando..." : "Salvar e Conectar"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

const IntegrationsPage = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <Plug />
        Integrações de Pagamento
      </h1>
      
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Mercado Pago</h2>
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <MercadoPagoConnectionCard
              type="production"
              title="Produção"
              description="Conecte sua loja para processar pagamentos reais."
              credentialsUrl="https://www.mercadopago.com.br/developers/panel/credentials"
            />
            <MercadoPagoConnectionCard
              type="test"
              title="Testes"
              description="Conecte com suas credenciais de teste para simular pagamentos."
              credentialsUrl="https://www.mercadopago.com.br/developers/panel/credentials"
            />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4 border-b pb-2">PagSeguro</h2>
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <PagSeguroConnectionCard
              type="production"
              title="Produção"
              description="Conecte sua loja para processar pagamentos reais."
              credentialsUrl="https://pagseguro.uol.com.br/vendedor/configuracoes.html"
            />
            <PagSeguroConnectionCard
              type="test"
              title="Testes (Sandbox)"
              description="Conecte com suas credenciais de teste para simular pagamentos."
              credentialsUrl="https://sandbox.pagseguro.uol.com.br/vendedor/configuracoes.html"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;