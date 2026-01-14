"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileUp, FileDown, Users, AlertCircle, Table as TableIcon, History, CheckCircle, XCircle, Loader2, Download } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/useUser";

interface DataJob {
  id: number;
  operation_type: string;
  status: string;
  summary: string;
  created_at: string;
  created_by: string;
}

const ImportClientsPage = () => {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [clientsToImport, setClientsToImport] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // --- QUERY: HISTÓRICO ---
  const { data: history, isLoading: isLoadingHistory } = useQuery<DataJob[]>({
    queryKey: ["data_jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
  });

  // --- MUTATION: LOG JOB ---
  const logJobMutation = useMutation({
    mutationFn: async (job: { operation_type: string, status: string, summary: string }) => {
      if (!user) return;
      await supabase.from("data_jobs").insert({
        ...job,
        created_by: user.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data_jobs"] });
    }
  });

  // --- IMPORTAÇÃO ---
  const bulkImportMutation = useMutation({
    mutationFn: async (clients: any[]) => {
      const { data, error } = await supabase.functions.invoke("bulk-import-clients", { 
        body: { clients } 
      });
      
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      showSuccess(data.message);
      setIsImportModalOpen(false);
      setClientsToImport([]);
      
      // Log Success
      logJobMutation.mutate({
        operation_type: "import_clients",
        status: "success",
        summary: `Importado: ${variables.length} registros via Excel.`
      });
    },
    onError: (error: Error) => {
      showError(`Erro na importação: ${error.message}`);
      // Log Error
      logJobMutation.mutate({
        operation_type: "import_clients",
        status: "error",
        summary: `Falha: ${error.message}`
      });
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

  // --- EXPORTAÇÃO ---
  const handleExportClients = async () => {
    setIsExporting(true);
    try {
      const { data: clients, error } = await supabase.functions.invoke("get-users");
      if (error) throw new Error(error.message || "Erro ao buscar clientes");

      if (!clients || clients.length === 0) {
        showError("Nenhum cliente encontrado para exportar.");
        return;
      }

      // Preparar dados para Excel
      const exportData = clients.map((c: any) => ({
        "ID": c.id,
        "Email": c.email,
        "Nome": c.first_name,
        "Sobrenome": c.last_name,
        "Data Cadastro": new Date(c.created_at).toLocaleDateString("pt-BR"),
        "Status": c.force_pix_on_next_purchase ? "Restrição PIX" : "Normal",
        "Total Pedidos": c.order_count,
        "Pedidos Concluídos": c.completed_order_count,
        "Função": c.role === 'adm' ? "Administrador" : "Cliente"
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes Exportados");
      
      const fileName = `Clientes_Tabacaria_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      showSuccess("Exportação concluída com sucesso!");

      logJobMutation.mutate({
        operation_type: "export_clients",
        status: "success",
        summary: `Exportado: ${clients.length} clientes.`
      });

    } catch (err: any) {
      console.error(err);
      showError("Falha na exportação.");
      logJobMutation.mutate({
        operation_type: "export_clients",
        status: "error",
        summary: `Erro: ${err.message}`
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            Gestão de Dados de Clientes
          </h1>
          <p className="text-muted-foreground text-sm">Importe ou exporte sua base de clientes via Excel.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Baixar Modelo */}
        <Card className="border-l-4 border-l-blue-500 shadow-md">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <FileDown className="h-5 w-5 text-blue-600" />
                    1. Baixar Modelo
                </CardTitle>
                <CardDescription>
                    Planilha padrão para preencher novos clientes.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant="outline" className="w-full border-blue-200 text-blue-700 hover:bg-blue-50" onClick={handleDownloadTemplate}>
                    Baixar Modelo (.xlsx)
                </Button>
            </CardContent>
        </Card>

        {/* Card 2: Importar */}
        <Card className="border-l-4 border-l-green-500 shadow-md">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <FileUp className="h-5 w-5 text-green-600" />
                    2. Importar Clientes
                </CardTitle>
                <CardDescription>
                    Envie a planilha preenchida para o sistema.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button className="w-full bg-green-600 hover:bg-green-700 font-bold" onClick={() => document.getElementById('client-import-input-page')?.click()}>
                    Selecionar Arquivo Excel
                </Button>
                <input type="file" id="client-import-input-page" className="hidden" onChange={handleImportXLSX} accept=".xlsx, .xls" />
            </CardContent>
        </Card>

        {/* Card 3: Exportar */}
        <Card className="border-l-4 border-l-purple-500 shadow-md">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Download className="h-5 w-5 text-purple-600" />
                    3. Exportar Base
                </CardTitle>
                <CardDescription>
                    Baixe todos os clientes cadastrados atualmente.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button className="w-full bg-purple-600 hover:bg-purple-700 font-bold" onClick={handleExportClients} disabled={isExporting}>
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {isExporting ? "Gerando..." : "Exportar Clientes (.xlsx)"}
                </Button>
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Tabela de Exemplo */}
        <Card>
            <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
                <TableIcon className="h-5 w-5 text-gray-500" />
                Exemplo de Preenchimento
            </CardTitle>
            <CardDescription>
                Use estes cabeçalhos exatos na primeira linha da planilha.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <div className="border rounded-md overflow-x-auto">
                <Table>
                <TableHeader className="bg-gray-50">
                    <TableRow>
                    <TableHead className="min-w-[120px]">Email*</TableHead>
                    <TableHead>Senha</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>UF</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow>
                    <TableCell className="font-medium text-blue-600">joao@email.com</TableCell>
                    <TableCell className="text-muted-foreground italic text-xs">(vazio)</TableCell>
                    <TableCell>João</TableCell>
                    <TableCell>11999998888</TableCell>
                    <TableCell>São Paulo</TableCell>
                    <TableCell>SP</TableCell>
                    </TableRow>
                </TableBody>
                </Table>
            </div>
            <div className="mt-4 text-xs bg-gray-50 p-3 rounded-lg border text-gray-600 space-y-1">
                <p><strong>Dica:</strong> Se a senha estiver vazia, será usado <code>123456</code>.</p>
                <p><strong>Nota:</strong> E-mails duplicados serão ignorados na importação.</p>
            </div>
            </CardContent>
        </Card>

        {/* Tabela de Histórico */}
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <History className="h-5 w-5 text-gray-500" />
                    Histórico de Operações
                </CardTitle>
                <CardDescription>
                    Registro das últimas importações e exportações realizadas.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader className="bg-gray-50">
                            <TableRow>
                                <TableHead className="w-[100px]">Tipo</TableHead>
                                <TableHead>Resumo</TableHead>
                                <TableHead className="w-[100px] text-right">Data</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingHistory ? (
                                <TableRow><TableCell colSpan={3} className="text-center h-24">Carregando...</TableCell></TableRow>
                            ) : history && history.length > 0 ? (
                                history.map((job) => (
                                    <TableRow key={job.id}>
                                        <TableCell>
                                            {job.operation_type === 'import_clients' ? (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Importação</Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Exportação</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-medium">{job.summary}</span>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    {job.status === 'success' ? (
                                                        <span className="text-[10px] text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Sucesso</span>
                                                    ) : (
                                                        <span className="text-[10px] text-red-600 flex items-center gap-1"><XCircle className="w-3 h-3" /> Erro</span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">
                                            {new Date(job.created_at).toLocaleDateString('pt-BR')} <br/>
                                            {new Date(job.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={3} className="text-center h-24 text-muted-foreground">Nenhum histórico recente.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>

      </div>

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