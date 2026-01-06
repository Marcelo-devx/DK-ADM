import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "../ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import { useEffect } from "react";

const formSchema = z.object({
  title: z.string().min(2, "O título é obrigatório."),
  content: z.string().min(10, "O conteúdo é obrigatório e deve ter pelo menos 10 caracteres."),
  button_text: z.string().min(2, "O texto do botão é obrigatório."),
  is_active: z.boolean().default(true),
});

type PopupFormValues = z.infer<typeof formSchema>;

interface PopupFormProps {
  onSubmit: (values: PopupFormValues) => void;
  isSubmitting: boolean;
  initialData?: Partial<PopupFormValues>;
}

export const PopupForm = ({
  onSubmit,
  isSubmitting,
  initialData,
}: PopupFormProps) => {
  const form = useForm<PopupFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      title: "",
      content: "",
      button_text: "Entendi",
      is_active: true,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título do Popup</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Aviso Importante" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conteúdo</FormLabel>
              <FormControl>
                <Textarea placeholder="Descreva a informação que será exibida no popup." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="button_text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Texto do Botão</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Entendi" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Ativo</FormLabel>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : (initialData ? "Salvar Alterações" : "Adicionar Popup")}
        </Button>
      </form>
    </Form>
  );
};