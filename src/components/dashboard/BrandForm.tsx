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
  name: z.string().min(2, "O nome da marca é obrigatório."),
  image_url: z.string().url("URL da imagem inválida.").optional().or(z.literal('')),
  is_visible: z.boolean().default(true),
});

type BrandFormValues = z.infer<typeof formSchema>;

interface BrandFormProps {
  onSubmit: (values: BrandFormValues) => void;
  isSubmitting: boolean;
  initialData?: Partial<BrandFormValues>;
}

export const BrandForm = ({ onSubmit, isSubmitting, initialData }: BrandFormProps) => {
  const form = useForm<BrandFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: "",
      image_url: "",
      is_visible: true,
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome da Marca</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Zomo" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="image_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Logo da Marca (Opcional)</FormLabel>
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
          name="is_visible"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Visível no site</FormLabel>
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
          {isSubmitting ? "Salvando..." : (initialData?.name ? "Salvar Alterações" : "Salvar Marca")}
        </Button>
      </form>
    </Form>
  );
};