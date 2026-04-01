import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreateClientForm } from "@/components/dashboard/CreateClientForm";
import { useClients } from "@/hooks/useClients";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

export default function CadastrarCliente() {
  const navigate = useNavigate();
  const [formKey, setFormKey] = useState(0);
  
  // Usar o hook useClients para acessar a mutação de criação
  const { create, createStatus } = useClients(1);

  const handleSubmit = (values: any) => {
    create(values, {
      onSuccess: () => {
        showSuccess("Cliente cadastrado com sucesso!");
        // Não resetamos o formulário para permitir ver o que foi preenchido
      },
      onError: (error: any) => {
        showError(error.message || "Erro ao cadastrar cliente");
      },
    });
  };

  const handleBackToList = () => {
    navigate("/dashboard/clients");
  };

  const handleClearForm = () => {
    // Incrementa a chave para forçar a recriação do formulário (reset limpo)
    setFormKey(prev => prev + 1);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToList}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Listagem
          </Button>
        </div>
        
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cadastrar Cliente</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preencha os dados abaixo para criar um novo cliente no sistema
          </p>
        </div>
      </div>

      {/* Formulário */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <CreateClientForm
          key={formKey}
          onSubmit={handleSubmit}
          isSubmitting={createStatus.isPending}
        />
      </div>

      {/* Botões de Ação Adicionais */}
      <div className="mt-4 flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={handleBackToList}
        >
          Voltar para Listagem
        </Button>
        <Button
          variant="ghost"
          onClick={handleClearForm}
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Limpar Formulário
        </Button>
      </div>
    </div>
  );
}