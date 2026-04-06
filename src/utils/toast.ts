import { toast } from "sonner";
import { translateDatabaseError } from "./error-handler";

export const showSuccess = (message: string) => {
  toast.success(message);
};

export const showError = (message: string) => {
  // Traduz erros comuns do banco de dados
  const translatedMessage = translateDatabaseError(message);
  toast.error(translatedMessage);
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};

// Função para mostrar erros de objetos (como erros do Supabase)
export const showErrorObject = (error: any) => {
  const errorMessage = error?.message || String(error);
  const translatedMessage = translateDatabaseError(errorMessage);
  toast.error(translatedMessage);
};