"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileUp, FileDown, Users, AlertCircle, Table as TableIcon } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import * as XLSX from 'xlsx';
import { mapRowKeys } from "@/utils/excel-utils";
import { ClientImportModal } from "@/components/dashboard/ClientImportModal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ImportClientsPage = () => {
  const queryClient = useQueryClient();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [clientsToImport, setClientsToImport] = useState<any[]>([]);

  const bulkImportMutation = useMutation({
    mutationFn: async (clients: any[]) => {
      const { data, error } = await supabase.functions.invoke("bulk-import-clients", { 
        body: { clients } 
      });
      
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      showSuccess(data.message);
      setIsImportModalOpen(false);
      setClientsToImport([]);
    },
    onError: (error: Error) => {
      showError(`Erro na importação: ${error.message}`);
    },
  });

  const handleImportXLSX = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
        
        const mappedClients = json.map(mapRowKeys).map((row: any) => ({
            email: row.email,
            first_name: row.nome || '',
            last_name: row.sobrenome || '',
            phone: row.telefone ? String(row.telefone) : '',
            cep: row.cep ? String(row.cep) : '',
            street: row.rua || '',
            number: row.numero ? String(row.numero) : '',
            complement: row.complemento || '',
            neighborhood: row.bairro || '',
            city: row.cidade || '',
            state: row.estado || '',
            password: row.senha ? String(row.senha) : undefined,
        })).filter((c: any) => c.email && c.email.includes('@'));

        if (mappedClients.length === 0) {
            showError("Nenhum cliente válido encontrado na planilha. Verifique a coluna 'Email'.");
            return;
        }

        setClientsToImport(mappedClients);
        setIsImportModalOpen(true);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const headers = [
        "Email", "Senha", "Nome", "Sobrenome", "Telefone", "CEP", "Rua", "Numero", "Complemento", "Bairro", "Cidade", "Estado"
    ];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");
    XLSX.writeFile(workbook, "modelo_importacao_clientes.xlsx");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            Importação de Clientes
          </h1>
          <p className="text-muted-foreground text-sm">Ferramentas para migração e cadastro em massa.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-blue-500 shadow-md">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <FileDown className="h-5 w-5 text-blue-600" />
                    1. Baixar Modelo
                </CardTitle>
                <CardDescription>
                    Comece baixando a planilha padrão para preencher os dados dos seus clientes corretamente.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant="outline" className="w-full h-12 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={handleDownloadTemplate}>
                    Baixar Planilha Modelo (.xlsx)
                </Button>
            </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-md">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <FileUp className="h-5 w-5 text-green-600" />
                    2. Enviar Planilha
                </CardTitle>
                <CardDescription>
                    Faça o upload da planilha preenchida. O sistema criará os usuários e perfis automaticamente.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button className="w-full h-12 bg-green-600 hover:bg-green-700 font-bold" onClick={() => document.getElementById('client-import-input-page')?.click()}>
                    Selecionar Arquivo Excel
                </Button>
                <input type="file" id="client-import-input-page" className="hidden" onChange={handleImportXLSX} accept=".xlsx, .xls" />
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TableIcon className="h-5 w-5 text-gray-500" />
            Exemplo de Preenchimento
          </CardTitle>
          <CardDescription>
            Certifique-se de que sua planilha siga a estrutura abaixo. A primeira linha deve conter os cabeçalhos exatos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="min-w-[150px]">Email*</TableHead>
                  <TableHead>Senha</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Sobrenome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>CEP</TableHead>
                  <TableHead>Rua</TableHead>
                  <TableHead>Numero</TableHead>
                  <TableHead>Bairro</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium text-blue-600">joao@exemplo.com</TableCell>
                  <TableCell className="text-muted-foreground italic text-xs">(vazio)</TableCell>
                  <TableCell>João</TableCell>
                  <TableCell>Silva</TableCell>
                  <TableCell>11999998888</TableCell>
                  <TableCell>01001000</TableCell>
                  <TableCell>Av. Paulista</TableCell>
                  <TableCell>100</TableCell>
                  <TableCell>Bela Vista</TableCell>
                  <TableCell>São Paulo</TableCell>
                  <TableCell>SP</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-blue-600">maria@teste.com</TableCell>
                  <TableCell>Muda123</TableCell>
                  <TableCell>Maria</TableCell>
                  <TableCell>Oliveira</TableCell>
                  <TableCell>21988887777</TableCell>
                  <TableCell>20040002</TableCell>
                  <TableCell>Rua Rio Branco</TableCell>
                  <TableCell>50</TableCell>
                  <TableCell>Centro</TableCell>
                  <TableCell>Rio de Janeiro</TableCell>
                  <TableCell>RJ</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 text-sm bg-gray-50 p-4 rounded-lg border text-gray-600 space-y-2">
            <p><span className="font-bold text-red-600">* Email:</span> Campo obrigatório. Não pode haver e-mails duplicados.</p>
            <p><span className="font-bold text-gray-900">Senha:</span> Opcional. Se deixar em branco, a senha padrão será <code className="bg-white px-2 py-0.5 rounded border border-gray-300 font-mono text-primary font-bold">123456</code>.</p>
            <p><span className="font-bold text-gray-900">Telefone:</span> Apenas números, com DDD (ex: 11999999999).</p>
          </div>
        </CardContent>
      </Card>

      <Alert className="bg-orange-50 border-orange-200">
        <AlertCircle className="h-4 w-4 text-orange-600" />
        <AlertTitle className="text-orange-800 font-bold">Importante</AlertTitle>
        <AlertDescription className="text-orange-700 text-sm mt-1">
            <ul className="list-disc pl-5 space-y-1">
                <li>Se o cliente já existir no sistema (mesmo e-mail), ele será <strong>ignorado</strong> nesta importação.</li>
                <li>Verifique se não há espaços em branco antes ou depois dos e-mails na sua planilha.</li>
            </ul>
        </AlertDescription>
      </Alert>

      {/* Modal de Importação */}
      <ClientImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        clientsToImport={clientsToImport} 
        onConfirm={() => bulkImportMutation.mutate(clientsToImport)}
        isSubmitting={bulkImportMutation.isPending}
      />
    </div>
  );
};

export default ImportClientsPage;