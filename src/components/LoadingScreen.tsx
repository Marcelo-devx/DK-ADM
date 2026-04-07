import { Loader2 } from "lucide-react";
import { Button } from "./ui/button";

interface LoadingScreenProps {
  message?: string;
  error?: Error | null;
  onRetry?: () => void;
}

export const LoadingScreen = ({ 
  message = "Carregando...", 
  error,
  onRetry 
}: LoadingScreenProps) => {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-md">
        {error ? (
          <>
            <div className="text-red-500 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Erro ao carregar
            </h2>
            <p className="text-gray-600 mb-4">
              {error.message || "Ocorreu um erro inesperado. Tente novamente."}
            </p>
            {onRetry && (
              <Button onClick={onRetry} variant="default">
                Tentar novamente
              </Button>
            )}
          </>
        ) : (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Carregando
            </h2>
            <p className="text-gray-600">
              {message}
            </p>
          </>
        )}
      </div>
    </div>
  );
};
