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
import { Switch } from "../ui/switch";
import { useEffect } from "react";
import * as Icons from "lucide-react";

const formSchema = z.object({
  icon_name: z.string().min(1, "O nome do ícone é obrigatório."),
  title: z.string().min(2, "O título é obrigatório."),
  subtitle: z.string().min(2, "O subtítulo é obrigatório."),
  is_visible: z.boolean().default(true),
});

type InfoBarItemFormValues = z.infer<typeof formSchema>;

interface InfoBarItemFormProps {
  onSubmit: (values: InfoBarItemFormValues) => void;
  isSubmitting: boolean;
  initialData?: Partial<InfoBarItemFormValues>;
}

export const InfoBarItemForm = ({ onSubmit, isSubmitting, initialData }: InfoBarItemFormProps) => {
  const form = useForm<InfoBarItemFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      icon_name: "",
      title: "",
      subtitle: "",
      is_visible: true,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  const iconName = form.watch("icon_name");
  const IconComponent = (Icons as any)[iconName] || Icons.HelpCircle;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="icon_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Ícone (Lucide)</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input placeholder="Ex: Truck" {...field} />
                </FormControl>
                <IconComponent className="h-6 w-6 text-muted-foreground" />
              </div>
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
                <Input placeholder="Ex: Frete Grátis" {...field} />
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
                <Input placeholder="Ex: Para todo o Brasil" {...field} />
              </FormControl>
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
          {isSubmitting ? "Salvando..." : (initialData?.title ? "Salvar Alterações" : "Adicionar Item")}
        </Button>
      </form>
    </Form>
  );
};