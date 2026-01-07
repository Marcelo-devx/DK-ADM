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
import { Eye, Smartphone, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  title: z.string().min(2, "O título é obrigatório."),
  content: z.string().min(10, "O conteúdo é obrigatório."),
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

  const watchedValues = form.watch();

  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Formulário - 2 colunas */}
      <div className="lg:col-span-2">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold">Título do Aviso</FormLabel>
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
                  <FormLabel className="font-bold">Conteúdo (Respeita 'Enter')</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Digite sua mensagem aqui..." 
                      className="min-h-[150px]"
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
                  <FormLabel className="font-bold">Texto do Botão</FormLabel>
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
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-white">
                  <div className="space-y-0.5">
                    <FormLabel>Ativar imediatamente</FormLabel>
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
            <Button type="submit" disabled={isSubmitting} className="w-full h-12 text-lg font-bold">
              {isSubmitting ? "Processando..." : (initialData ? "Salvar Alterações" : "Criar Aviso")}
            </Button>
          </form>
        </Form>
      </div>

      {/* Preview - 3 colunas */}
      <div className="lg:col-span-3 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-black text-gray-500 uppercase tracking-widest">
                <Eye className="w-4 h-4" /> Preview Real
            </div>
            <div className="flex gap-2">
                <Badge variant="outline" className="gap-1 bg-white"><Smartphone className="w-3 h-3" /> Mobile</Badge>
                <Badge variant="outline" className="gap-1 bg-white"><Monitor className="w-3 h-3" /> Desktop</Badge>
            </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center bg-slate-200 rounded-2xl border-4 border-white shadow-inner p-4 min-h-[400px]">
          {/* Simulador de Modal */}
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-[400px] overflow-hidden border animate-in zoom-in-95 duration-300">
            <div className="p-8 flex flex-col items-center text-center space-y-6">
              <h3 className="text-2xl font-black text-gray-900 leading-tight">
                {watchedValues.title || "Título do Seu Aviso"}
              </h3>
              <p className="text-base text-gray-600 whitespace-pre-wrap leading-relaxed">
                {watchedValues.content || "Digite o conteúdo ao lado para ver como o texto será organizado e centralizado aqui no preview."}
              </p>
              <div className="w-full pt-4">
                <Button className="w-full h-12 text-md font-bold rounded-lg pointer-events-none shadow-lg">
                  {watchedValues.button_text || "Entendi"}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-center text-slate-500 font-medium">
          O preview acima reflete o alinhamento e as quebras de linha reais do site.
        </p>
      </div>
    </div>
  );
};