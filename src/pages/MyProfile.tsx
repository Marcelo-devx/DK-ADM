import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { showSuccess, showError } from "@/utils/toast";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const profileSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  cpf_cnpj: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  cep: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const fetchProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw new Error(error.message);
  return data;
};

const MyProfilePage = () => {
  const { user, loading: userLoading } = useUser();
  const queryClient = useQueryClient();
  const [isConfirmAlertOpen, setConfirmAlertOpen] = useState(false);
  const [formData, setFormData] = useState<ProfileFormValues | null>(null);

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user,
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        ...profile,
        cpf_cnpj: profile.cpf_cnpj || "",
        gender: profile.gender || "",
      });
    }
  }, [profile, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async ({ values, forcePix }: { values: ProfileFormValues, forcePix: boolean }) => {
      const updateData = { ...values, force_pix_on_next_purchase: forcePix };
      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user!.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      showSuccess("Perfil atualizado com sucesso!");
      setConfirmAlertOpen(false);
    },
    onError: (error: Error) => {
      showError(`Erro ao atualizar perfil: ${error.message}`);
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    let dataChanged = false;
    const formKeys = Object.keys(values) as (keyof ProfileFormValues)[];

    for (const key of formKeys) {
      const originalValue = profile?.[key] ?? "";
      const newValue = values[key] ?? "";
      // Comparação simples, ignorando nulos/vazios iguais
      if ((originalValue || "") !== (newValue || "")) {
        dataChanged = true;
        break;
      }
    }

    if (dataChanged) {
      setFormData(values);
      // Se alterou CPF ou Endereço, pede confirmação de segurança (força PIX)
      // Se for apenas Nome/Gênero, pode salvar direto (opcional, mantendo padrão seguro para tudo por enquanto)
      setConfirmAlertOpen(true);
    } else {
      showSuccess("Nenhuma alteração detectada.");
    }
  };

  const handleConfirmUpdate = () => {
    if (formData) {
      updateProfileMutation.mutate({ values: formData, forcePix: true });
    }
  };

  if (userLoading || isLoadingProfile) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Meu Perfil</h1>
      <Card>
        <CardHeader>
          <CardTitle>Seus Dados</CardTitle>
          <CardDescription>Mantenha suas informações de contato e endereço atualizadas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="first_name" render={({ field }) => (<FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="last_name" render={({ field }) => (<FormItem><FormLabel>Sobrenome</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="cpf_cnpj" render={({ field }) => (<FormItem><FormLabel>CPF / CNPJ</FormLabel><FormControl><Input placeholder="000.000.000-00" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Telefone</FormLabel><FormControl><Input placeholder="(00) 00000-0000" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField 
                    control={form.control} 
                    name="gender" 
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Gênero</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                <SelectItem value="Masculino">Masculino</SelectItem>
                                <SelectItem value="Feminino">Feminino</SelectItem>
                                <SelectItem value="Outro">Outro</SelectItem>
                                <SelectItem value="Prefiro não dizer">Prefiro não dizer</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} 
                />
              </div>

              <hr />
              <h3 className="text-lg font-semibold">Endereço</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="cep" render={({ field }) => (<FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="street" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Rua</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="number" render={({ field }) => (<FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="complement" render={({ field }) => (<FormItem><FormLabel>Complemento</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="neighborhood" render={({ field }) => (<FormItem><FormLabel>Bairro</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="city" render={({ field }) => (<FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="state" render={({ field }) => (<FormItem><FormLabel>Estado</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              
              <Button type="submit" disabled={updateProfileMutation.isPending} className="w-full md:w-auto">
                {updateProfileMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <AlertDialog open={isConfirmAlertOpen} onOpenChange={setConfirmAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmação de Segurança</AlertDialogTitle>
            <AlertDialogDescription>
              Detectamos uma alteração nos seus dados. Por segurança, sua próxima compra em nosso site deverá ser realizada exclusivamente via Pix. Você confirma esta alteração?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpdate}>Confirmar e Atualizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyProfilePage;