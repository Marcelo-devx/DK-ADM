import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/hooks/useUser';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { StarRating } from './StarRating';
import { showSuccess, showError } from '@/utils/toast';
import { useQueryClient } from '@tanstack/react-query';

const reviewSchema = z.object({
  rating: z.number().min(1, "A avaliação é obrigatória.").max(5),
  comment: z.string().optional(),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

interface ReviewFormProps {
  productId: number;
  orderId: number;
  onSuccess: () => void;
}

export const ReviewForm = ({ productId, orderId, onSuccess }: ReviewFormProps) => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 0,
      comment: '',
    },
  });

  const onSubmit = async (values: ReviewFormValues) => {
    if (!user) {
      showError("Você precisa estar logado para avaliar.");
      return;
    }

    const { error } = await supabase.from('reviews').insert({
      product_id: productId,
      order_id: orderId,
      user_id: user.id,
      rating: values.rating,
      comment: values.comment,
    });

    if (error) {
      showError(error.code === '23505' ? 'Você já avaliou este produto neste pedido.' : `Erro ao enviar avaliação: ${error.message}`);
    } else {
      showSuccess('Avaliação enviada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
      onSuccess();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="rating"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sua Avaliação</FormLabel>
              <FormControl>
                <StarRating rating={field.value} setRating={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Seu Comentário (Opcional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Conte-nos o que você achou do produto..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Enviando...' : 'Enviar Avaliação'}
        </Button>
      </form>
    </Form>
  );
};