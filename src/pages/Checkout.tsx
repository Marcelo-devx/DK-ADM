import { useCheckout } from '@/hooks/useCheckout';
import { CancelOrderDialog } from '@/components/CancelOrderDialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { showSuccess } from '@/utils/toast';

const CheckoutPage = () => {
    const navigate = useNavigate();

    const handleCheckoutSuccess = (newOrderData: any) => {
        showSuccess(`Novo pedido #${newOrderData.new_order_id} criado com sucesso!`);
        navigate('/my-orders');
    };

    const {
        initiateCheckout,
        isProcessing,
        pendingOrder,
        handleConfirmAndProceed,
        closeConfirmation,
    } = useCheckout(handleCheckoutSuccess);

    const handleFakeCheckout = () => {
        // This is a fake payload. In a real app, this would come from the cart and forms.
        const fakePayload = {
            shipping_cost_input: 10.50,
            shipping_address_input: {
                street: "Rua Teste",
                number: "123",
                complement: "",
                neighborhood: "Centro",
                city: "Curitiba",
                state: "PR",
                cep: "80000-000"
            },
            cart_items_input: JSON.stringify([
                { itemId: 1, itemType: 'product', quantity: 1, variantId: null } // Assuming product with ID 1 exists
            ])
        };
        initiateCheckout(fakePayload);
    };

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-2xl font-bold">Página de Checkout (Demonstração)</h1>
            <p className="text-muted-foreground mb-8">
                Esta é uma página de exemplo para demonstrar o fluxo de cancelamento de pedido pendente.
            </p>

            <Card className="max-w-md">
                <CardHeader>
                    <CardTitle>Resumo do Pedido</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Item de exemplo: Produto ID 1 (1x)</p>
                    <p>Frete: R$ 10,50</p>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleFakeCheckout} disabled={isProcessing}>
                        {isProcessing && !pendingOrder ? <Loader2 className="animate-spin mr-2" /> : null}
                        Finalizar Compra
                    </Button>
                </CardFooter>
            </Card>

            <CancelOrderDialog
                isOpen={!!pendingOrder}
                onClose={closeConfirmation}
                onConfirm={handleConfirmAndProceed}
                isProcessing={isProcessing}
                pendingOrderId={pendingOrder?.id || null}
            />
        </div>
    );
};

export default CheckoutPage;