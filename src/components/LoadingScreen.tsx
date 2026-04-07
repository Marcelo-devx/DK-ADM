import { Loader2, AlertTriangle, RefreshCw, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

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
  const isAuthError = error?.message?.includes('Refresh Token') || 
                      error?.message?.includes('refresh_token') ||
                      error?.message?.includes('session') ||
                      error?.message?.includes('auth');

  const handleGoToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-md w-full">
        {error ? (
          <Card className="p-8 shadow-lg">
            <div className="text-red-500 mb-4">
              <AlertTriangle className="h-16 w-16 mx-auto" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">
              {isAuthError ? 'Problema na Sessão' : 'Erro ao Carregar'}
            </h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              {isAuthError 
                ? 'Sua sessão expirou ou houve um problema de autenticação. Por favor, faça login novamente.'
                : (error.message || "Ocorreu um erro inesperado. Tente novamente.")}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {isAuthError ? (
                <Button onClick={handleGoToLogin} variant="default" className="w-full sm:w-auto">
                  <LogOut className="w-4 h-4 mr-2" />
                  Ir para Login
                </Button>
              ) : (
                <>
                  {onRetry && (
                    <Button onClick={onRetry} variant="default" className="w-full sm:w-auto">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Tentar Novamente
                    </Button>
                  )}
                  <Button onClick={handleGoToLogin} variant="outline" className="w-full sm:w-auto">
                    <LogOut className="w-4 h-4 mr-2" />
                    Voltar ao Login
                  </Button>
                </>
              )}
            </div>
            {error.message && !isAuthError && (
              <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                <p className="text-xs text-gray-500 font-mono">
                  Detalhes do erro: {error.message}
                </p>
              </div>
            )}
          </Card>
        ) : (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">
              Carregando
            </h2>
            <p className="text-gray-600 text-lg">
              {message}
            </p>
            <p className="text-gray-400 text-sm mt-4">
              Isso pode levar alguns instantes...
            </p>
          </>
        )}
      </div>
    </div>
  );
};