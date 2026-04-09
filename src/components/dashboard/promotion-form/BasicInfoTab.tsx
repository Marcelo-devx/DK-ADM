import { useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "../ImageUploader";
import { Tag } from "lucide-react";

interface BasicInfoTabProps {
  onSubmit: (values: { name: string; description: string; image_url: string }) => void;
  isSubmitting?: boolean;
  initialData?: {
    name?: string;
    description?: string;
    image_url?: string;
  };
}

export const BasicInfoTab = ({
  onSubmit,
  isSubmitting = false,
  initialData,
}: BasicInfoTabProps) => {
  const form = useForm({
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      image_url: initialData?.image_url || "",
    },
  });

  const handleSubmit = (values: { name: string; description: string; image_url: string }) => {
    if (!values.name || values.name.trim().length < 2) {
      form.setError("name", {
        type: "manual",
        message: "O nome é obrigatório.",
      });
      return false;
    }
    onSubmit(values);
    return true;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b">
          <Tag className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-bold text-gray-700 uppercase">1. Dados Básicos</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Kit/Promoção</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Combo Iniciante Zomo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição Comercial</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva os benefícios deste kit..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Imagem Exclusiva do Kit</FormLabel>
                  <ImageUploader
                    onUploadSuccess={(url) => field.onChange(url)}
                    initialUrl={field.value}
                    label="Capa da Promoção"
                    className="h-[240px] max-w-full"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? "Criando..." : "Avançar →"}
          </Button>
        </div>
      </form>
    </Form>
  );
};