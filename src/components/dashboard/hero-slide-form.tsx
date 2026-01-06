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
import { ImageUploader } from "./ImageUploader";
import { useEffect } from "react";
import { Switch } from "../ui/switch";

const formSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  button_url: z.string().url("URL inválida.").optional().or(z.literal('')),
  image_url: z.string().url("URL da imagem/vídeo inválida.").optional().or(z.literal('')),
  is_active: z.boolean().default(true),
});

type HeroSlideFormValues = z.infer<typeof formSchema>;

interface HeroSlideFormProps {
  onSubmit: (values: HeroSlideFormValues) => void;
  isSubmitting: boolean;
  initialData?: Partial<HeroSlideFormValues & { button_text?: string }>;
}

const isVideo = (url: string) => {
    if (!url) return false;
    return /\.(mp4|webm|ogg)$/i.test(url);
}

export const HeroSlideForm = ({
  onSubmit,
  isSubmitting,
  initialData,
}: HeroSlideFormProps) => {
  const form = useForm<HeroSlideFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      title: "",
      subtitle: "",
      button_url: "",
      image_url: "",
      is_active: true,
    },
  });

  const mediaUrl = form.watch("image_url");
  const title = form.watch("title");
  const subtitle = form.watch("subtitle");

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
          name="image_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Imagem ou Vídeo do Slide</FormLabel>
              <ImageUploader
                onUploadSuccess={(url) => field.onChange(url)}
                initialUrl={field.value}
                accept="image/*,video/mp4,video/webm"
              />
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input placeholder="Título principal do slide" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="subtitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subtítulo</FormLabel>
              <FormControl>
                <Input placeholder="Texto secundário (opcional)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="button_url"
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

        {mediaUrl && (
          <div>
            <FormLabel>Preview</FormLabel>
            <div className="relative mt-2 w-full h-48 border rounded-md overflow-hidden bg-black flex items-center justify-center">
              {isVideo(mediaUrl) ? (
                <video src={mediaUrl} className="w-full h-full object-cover" autoPlay loop muted playsInline />
              ) : (
                <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-black bg-opacity-30 flex flex-col items-center justify-center text-center p-4 text-white">
                {title && <h2 className="text-2xl font-bold">{title}</h2>}
                {subtitle && <p className="mt-2 text-lg">{subtitle}</p>}
              </div>
            </div>
          </div>
        )}

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Ativo</FormLabel>
                <FormMessage />
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
          {isSubmitting ? "Salvando..." : (initialData ? "Salvar Alterações" : "Adicionar Slide")}
        </Button>
      </form>
    </Form>
  );
};