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

const formSchema = z.object({
  name: z.string().min(2, "O nome do sabor é obrigatório."),
  is_visible: z.boolean().default(true),
});

type FlavorFormValues = z.infer<typeof formSchema>;

interface FlavorFormProps {
  onSubmit: (values: FlavorFormValues) => void;
  isSubmitting: boolean;
  initialData?: Partial<FlavorFormValues>;
}

export const FlavorForm = ({ onSubmit, isSubmitting, initialData }: FlavorFormProps) => {
  const form = useForm<FlavorFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: "",
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
              <FormLabel>Nome do Sabor</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Menta" {...field} />
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
          {isSubmitting ? "Salvando..." : (initialData?.name ? "Salvar Alterações" : "Salvar Sabor")}
        </Button>
      </form>
    </Form>
  );
};