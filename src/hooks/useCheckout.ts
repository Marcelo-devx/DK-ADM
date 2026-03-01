import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/hooks/useUser';
import { showError, showSuccess } from '@/utils/toast';

interface PendingOrder {
  id: number;
}

export const useCheckout = (onCheckoutSuccess: (newOrderData: any) => void) => {
    const { user } = useUser();
    const [isProcessing, setIsProcessing] = useState(false);
    const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
    const [orderPayload, setOrderPayload] = useState<any | null>(null);

    const createOrder = async (payload: any) => {
        const { data, error } = await supabase.rpc('create_pending_order_from_local_cart', payload);
        if (error) throw error;
        return data;
    };

    const cancelOrder = async (orderId: number) => {
        const { error } = await supabase
            .from('orders')
            .update({ status: 'Cancelado' })
            .eq('id', orderId);
        if (error) throw error;
    };

    const handleConfirmAndProceed = async () => {
        if (!orderPayload) return;
        
        setIsProcessing(true);
        try {
            if (pendingOrder) {
                await cancelOrder(pendingOrder.id);
                showSuccess(`Pedido #${pendingOrder.id} cancelado.`);
            }
            const newOrderData = await createOrder(orderPayload);
            onCheckoutSuccess(newOrderData);
        } catch (err: any) {
            showError(err.message);
        } finally {
            setIsProcessing(false);
            setPendingOrder(null);
            setOrderPayload(null);
        }
    };

    const initiateCheckout = async (payload: any) => {
        if (!user) {
            showError("Você precisa estar logado para finalizar a compra.");
            return;
        }

        setIsProcessing(true);
        try {
            const { data: existingPendingOrder } = await supabase
                .from('orders')
                .select('id')
                .eq('user_id', user.id)
                .eq('status', 'Aguardando Pagamento')
                .maybeSingle();

            if (existingPendingOrder) {
                setPendingOrder(existingPendingOrder);
                setOrderPayload(payload);
            } else {
                const newOrderData = await createOrder(payload);
                onCheckoutSuccess(newOrderData);
            }
        } catch (err: any) {
            showError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        initiateCheckout,
        isProcessing,
        pendingOrder,
        handleConfirmAndProceed,
        closeConfirmation: () => setPendingOrder(null),
    };
};