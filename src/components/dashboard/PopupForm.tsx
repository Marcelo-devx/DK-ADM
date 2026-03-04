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
import { Switch } from "../ui/switch";
import { useEffect } from "react";
import { Eye, Smartphone, Monitor, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const formSchema = z.object({
  id: z.number().optional(),
  title: z.string().min(2, "O título é obrigatório."),
  content: z.string().min(1, "O conteúdo é obrigatório."),
  button_text: z.string().min(2, "O texto do botão é obrigatório."),
  sort_order: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
});

type PopupFormValues = z.infer<typeof formSchema>;

interface PopupFormProps {
  onSubmit: (values: PopupFormValues) => void;
  isSubmitting: boolean;
  initialData?: Partial<PopupFormValues>;
}

const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'align': [] }],
    ['clean']
  ],
};

const quillFormats = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'align'
];

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
      sort_order: 0,
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
      {/* Formulário */}
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
                  <FormLabel className="font-bold">Conteúdo (Estilo Word)</FormLabel>
                  <FormControl>
                    <div className="bg-white">
                      <ReactQuill 
                        theme="snow"
                        value={field.value}
                        onChange={field.onChange}
                        modules={quillModules}
                        formats={quillFormats}
                        placeholder="Escreva sua mensagem aqui..."
                        className="h-[200px] mb-12"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
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
                    name="sort_order"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="font-bold">Ordem (0, 1, 2...)</FormLabel>
                        <FormControl>
                            <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

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
              {isSubmitting ? "Processando..." : (initialData?.id ? "Salvar Alterações" : "Criar Aviso")}
            </Button>
          </form>
        </Form>
      </div>

      {/* Preview Real Style */}
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
        
        <div className="flex-1 flex items-center justify-center bg-slate-100 rounded-2xl border-4 border-white shadow-inner p-4 min-h-[500px]">
          <div className="bg-[#0B1221] rounded-[2.5rem] shadow-2xl w-full max-w-[420px] overflow-hidden border-[#1E293B] border animate-in zoom-in-95 duration-300">
            <div className="p-8 flex flex-col items-center text-center space-y-6">
              
              <div className="bg-[#1E293B] p-4 rounded-2xl">
                <Info className="h-8 w-8 text-[#0099FF]" />
              </div>

              <h3 className="text-3xl font-black text-white italic uppercase tracking-tight leading-tight">
                {watchedValues.title || "Título do Seu Aviso"}
              </h3>
              
              <div 
                className="text-gray-400 text-base leading-relaxed w-full ql-editor-preview custom-scrollbar-preview max-h-[300px] overflow-y-auto pr-2"
                dangerouslySetInnerHTML={{ __html: watchedValues.content || "Digite o conteúdo ao lado..." }}
              />
              
              <div className="w-full pt-4">
                <Button className="w-full h-14 bg-[#0099FF] hover:bg-[#0088EE] text-white font-black rounded-2xl text-lg uppercase shadow-lg shadow-[#0099FF]/20 pointer-events-none">
                  {watchedValues.button_text || "Entendi"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .ql-editor-preview {
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
        }
        .ql-editor-preview p { margin-bottom: 0.75rem; }
        .ql-editor-preview p:last-child { margin-bottom: 0; }
        .ql-editor-preview strong { color: white; }
        
        .custom-scrollbar-preview::-webkit-scrollbar {
            width: 4px;
        }
        .custom-scrollbar-preview::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
        }
        .custom-scrollbar-preview::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 10px;
        }
      `}</style>
    </div>
  );
};