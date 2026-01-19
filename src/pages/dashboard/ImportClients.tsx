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

  // Função para converter formatos de data brasileiros para ISO
  const formatDateToISO = (val: any) => {
    if (!val) return null;
    const str = String(val).trim();
    const match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (match) {
        const [_, d, m, y] = match;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return val;
  };

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
            password: row.senha ? String(row.senha) : undefined,
            full_name: row.nomecompleto || '',
            cpf_cnpj: row.cpfcnpj ? String(row.cpfcnpj) : '',
            gender: row.sexo || '',
            date_of_birth: formatDateToISO(row.datadenascimento),
            client_since: formatDateToISO(row.clientedesde),
            phone: row.telefone ? String(row.telefone) : '',
            cep: row.cep ? String(row.cep) : '',
            street: row.rua || '',
            number: row.numero ? String(row.numero) : '',
            complement: row.complemento || '',
            neighborhood: row.bairro || '',
            city: row.cidade || '',
            state: row.estado || '',
        })).filter((c: any) => c.email && c.email.includes('@'));

        if (mappedClients.length === 0) {
            showError("Nenhum cliente válido encontrado. Verifique a coluna 'Email'.");
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
        "Email", "Senha", "Nome Completo", "CPF/CNPJ", "Sexo", "Data de Nascimento", "Cliente Desde", "Telefone", "CEP", "Rua", "Numero", "Complemento", "Bairro", "Cidade", "Estado"
    ];
    const exampleRow = [
        "cliente@exemplo.com", "123456", "João da Silva", "123.456.789-00", "Masculino", "15-05-1990", "01-01-2023", "11999998888", "01001000", "Rua das Flores", "123", "Apto 12", "Centro", "São Paulo", "SP"
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
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
          <p className="text-muted-foreground text-sm">Migre sua base de dados incluindo CPF, Gênero e Histórico.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-blue-500 shadow-md">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <FileDown className="h-5 w-5 text-blue-600" />
                    1. Baixar Modelo
                </CardTitle>
                <CardDescription>Baixe a planilha com os novos campos (CPF, Sexo, Data de Cadastro).</CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant="outline" className="w-full h-12 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={handleDownloadTemplate}>
                    Baixar Planilha Atualizada (.xlsx)
                </Button>
            </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-md">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <FileUp className="h-5 w-5 text-green-600" />
                    2. Enviar Planilha
                </CardTitle>
                <CardDescription>Envie o arquivo preenchido para processar os cadastros.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button className="w-full h-12 bg-green-600 hover:bg-green-700 font-bold" onClick={() => document.getElementById('client-import-input-new')?.click()}>
                    Selecionar Arquivo Excel
                </Button>
                <input type="file" id="client-import-input-new" className="hidden" onChange={handleImportXLSX} accept=".xlsx, .xls" />
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TableIcon className="h-5 w-5 text-gray-500" /> Estrutura da Planilha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50 text-[10px] uppercase">
                <TableRow>
                  <TableHead>Email*</TableHead>
                  <TableHead>Nome Completo</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Sexo</TableHead>
                  <TableHead>Nascimento</TableHead>
                  <TableHead>Cliente Desde</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="text-[11px]">
                  <TableCell className="font-medium text-blue-600">exemplo@email.com</TableCell>
                  <TableCell>João da Silva</TableCell>
                  <TableCell>123.456.789-00</TableCell>
                  <TableCell>Masculino</TableCell>
                  <TableCell>15-05-1990</TableCell>
                  <TableCell>01-01-2023</TableCell>
                  <TableCell>11999998888</TableCell>
                  <TableCell>São Paulo</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 text-sm bg-gray-50 p-4 rounded-lg border text-gray-600 space-y-2">
            <p><span className="font-bold text-gray-900">Datas:</span> Use o formato <code className="bg-white px-2 py-0.5 rounded border border-gray-300 font-bold">DD-MM-AAAA</code>.</p>
            <p><span className="font-bold text-gray-900">Senha:</span> Se não for fornecida na planilha, será definida como <code className="bg-white px-2 py-0.5 rounded border border-gray-300 font-bold">123456</code>.</p>
            <p><span className="font-bold text-gray-900">Cliente Desde:</span> Se deixar em branco, o sistema usará a data atual do cadastro.</p>
          </div>
        </CardContent>
      </Card>

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