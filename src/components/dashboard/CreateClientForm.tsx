"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres."),
  first_name: z.string().min(2, "O nome é obrigatório."),
  last_name: z.string().optional(),
  gender: z.string().optional(),
  date_of_birth: z.string().optional(),
});

type CreateClientFormValues = z.infer<typeof formSchema>;

interface CreateClientFormProps {
  onSubmit: (values: CreateClientFormValues) => void;
  isSubmitting: boolean;
}

export const CreateClientForm = ({ onSubmit, isSubmitting }: CreateClientFormProps) => {
  const form = useForm<CreateClientFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      first_name: "",
      last_name: "",
      gender: "Não Informado",
      date_of_birth: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl><Input placeholder="João" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Sobrenome</FormLabel>
                    <FormControl><Input placeholder="Silva" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail do Cliente</FormLabel>
              <FormControl>
                <Input placeholder="cliente@email.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Gênero</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="Masculino">Masculino</SelectItem>
                            <SelectItem value="Feminino">Feminino</SelectItem>
                            <SelectItem value="Outro">Outro</SelectItem>
                            <SelectItem value="Não Informado">Não Informado</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="date_of_birth"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Nascimento</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Senha de Acesso</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting} className="w-full font-bold">
          {isSubmitting ? "Criando..." : "Cadastrar Cliente"}
        </Button>
      </form>
    </Form>
  );
};