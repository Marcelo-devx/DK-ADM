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

const formSchema = z.object({
  name: z.string().min(2, "O nome é obrigatório."),
  phone: z.string().min(8, "Telefone inválido."),
});

type DriverFormValues = z.infer<typeof formSchema>;

interface DriverFormProps {
  onSubmit: (values: DriverFormValues) => void;
  isSubmitting: boolean;
  initialData?: Partial<DriverFormValues>;
}

export const DriverForm = ({ onSubmit, isSubmitting, initialData }: DriverFormProps) => {
  const form = useForm<DriverFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: "",
      phone: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Motorista</FormLabel>
              <FormControl>
                <Input placeholder="Ex: João Silva" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone / WhatsApp</FormLabel>
              <FormControl>
                <Input placeholder="(00) 00000-0000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar Motorista"}
        </Button>
      </form>
    </Form>
  );
};