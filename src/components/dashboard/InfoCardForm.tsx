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
import { ImageUploader } from "./ImageUploader";
import { useEffect } from "react";
import { Switch } from "../ui/switch";

const formSchema = z.object({
  image_url: z.string().url("URL da imagem é obrigatória.").min(1, "A imagem é obrigatória."),
  link_url: z.string().url("URL inválida.").optional().or(z.literal('')),
  is_visible: z.boolean().default(true),
  is_link_active: z.boolean().default(true),
});

type InfoCardFormValues = z.infer<typeof formSchema>;

interface InfoCardFormProps {
  onSubmit: (values: InfoCardFormValues) => void;
  isSubmitting: boolean;
  initialData?: Partial<InfoCardFormValues>;
}

export const InfoCardForm = ({ onSubmit, isSubmitting, initialData }: InfoCardFormProps) => {
  const form = useForm<InfoCardFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      image_url: "",
      link_url: "",
      is_visible: true,
      is_link_active: true,
    },
  });

  const linkUrl = form.watch("link_url");

  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  useEffect(() => {
    if (!linkUrl) {
      form.setValue("is_link_active", false);
    }
  }, [linkUrl, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="image_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Imagem do Card</FormLabel>
              <ImageUploader
                onUploadSuccess={(url) => field.onChange(url)}
                initialUrl={field.value}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="link_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL de Destino (Opcional)</FormLabel>
              <FormControl>
                <Input placeholder="/produtos/nome-do-produto" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="is_visible"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <FormLabel>Visível</FormLabel>
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
          <FormField
            control={form.control}
            name="is_link_active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <FormLabel>Link Ativo</FormLabel>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={!linkUrl}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : (initialData?.image_url ? "Salvar Alterações" : "Adicionar Card")}
        </Button>
      </form>
    </Form>
  );
};