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
import { Eye } from "lucide-react";

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

  // Monitora os campos para o preview
  const watchedValues = form.watch();

  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Formulário */}
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
                  <Textarea 
                    placeholder="Descreva a informação que será exibida no popup." 
                    className="min-h-[120px]"
                    {...field} 
                  />
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
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Salvando..." : (initialData ? "Salvar Alterações" : "Adicionar Popup")}
          </Button>
        </form>
      </Form>

      {/* Seção de Preview */}
      <div className="flex flex-col space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase">
          <Eye className="w-4 h-4" /> Preview do Modal
        </div>
        
        <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-xl border-2 border-dashed p-8">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-[350px] overflow-hidden border border-gray-200">
            <div className="p-6 text-center space-y-4">
              <h3 className="text-lg font-bold text-gray-900 break-words">
                {watchedValues.title || "Título do Aviso"}
              </h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap break-words leading-relaxed">
                {watchedValues.content || "O conteúdo do seu aviso aparecerá aqui em tempo real enquanto você digita..."}
              </p>
              <div className="pt-2">
                <Button className="w-full pointer-events-none bg-primary">
                  {watchedValues.button_text || "Botão"}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-center text-muted-foreground italic">
          Nota: Esta é uma simulação aproximada de como o cliente verá o aviso no site.
        </p>
      </div>
    </div>
  );
};