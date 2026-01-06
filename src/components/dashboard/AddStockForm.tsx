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
  quantity: z.coerce
    .number()
    .int()
    .min(1, "A quantidade a ser adicionada deve ser de no mínimo 1."),
});

type AddStockFormValues = z.infer<typeof formSchema>;

interface AddStockFormProps {
  onSubmit: (values: AddStockFormValues) => void;
  isSubmitting: boolean;
}

export const AddStockForm = ({
  onSubmit,
  isSubmitting,
}: AddStockFormProps) => {
  const form = useForm<AddStockFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantidade a Adicionar</FormLabel>
              <FormControl>
                <Input type="number" min="1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Adicionando..." : "Adicionar Estoque"}
        </Button>
      </form>
    </Form>
  );
};