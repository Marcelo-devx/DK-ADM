import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, Loader2, CheckCircle, AlertCircle, Download } from 'lucide-react'
import { read, utils } from 'xlsx'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface ProcessingResult {
  email: string
  userId?: string
  points: number
  status: 'success' | 'failed' | 'not_found'
  error?: string
}

export default function BulkAddPoints() {
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState<ProcessingResult[]>([])
  const [summary, setSummary] = useState<{ success: number; failed: number; notFound: number } | null>(null)
  const [processedCount, setProcessedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      processPreview(selectedFile)
    }
  }

  const processPreview = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows = utils.sheet_to_json(sheet)
        
        setPreview(rows.slice(0, 10)) // Mostrar primeiras 10 linhas
        toast({
          title: 'Arquivo lido com sucesso',
          description: `${rows.length} linhas encontradas no arquivo`
        })
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Erro ao ler arquivo',
          description: 'Certifique-se de que é um arquivo Excel válido'
        })
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const processBulkAddPoints = async (dryRun: boolean = true) => {
    if (!file) {
      toast({
        variant: 'destructive',
        title: 'Nenhum arquivo selecionado',
        description: 'Por favor, selecione um arquivo Excel primeiro'
      })
      return
    }

    setProcessing(true)
    setResults([])
    setSummary(null)
    setProcessedCount(0)
    setTotalCount(0)

    const processingResults: ProcessingResult[] = []
    
    try {
      // Ler o arquivo novamente
      const data = await file.arrayBuffer()
      const workbook = read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rows = utils.sheet_to_json(sheet)

      setTotalCount(rows.length)

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        // Extrair email e pontos - tentar variações de nomes de colunas
        const email = row['email'] || row['Email'] || row['EMAIL'] || row['E-mail'] || row['E-MAIL']
        const rawPoints = row['pontos'] || row['Pontos'] || row['PONTOS'] || row['ponto'] || row['Ponto'] || row['ponto(s)'] || row['Ponto(s)'] || '0'
        const points = parseInt(String(rawPoints).toString().replace(/[^0-9-]/g, ''))

        if (dryRun) {
          // Processamento em chunks para não travar a UI
          if (!email || isNaN(points)) {
            processingResults.push({
              email: email || 'N/A',
              points: 0,
              status: 'failed',
              error: 'Email inválido ou pontos não informados'
            })
          } else {
            processingResults.push({
              email,
              points,
              status: 'success'
            })
          }

          // Atualiza contadores e estado periodicamente para mostrar progresso
          if (i % 200 === 0 || i === rows.length - 1) {
            setResults([...processingResults])
            setProcessedCount(i + 1)
            setSummary({
              success: processingResults.filter(r => r.status === 'success').length,
              failed: processingResults.filter(r => r.status === 'failed').length,
              notFound: processingResults.filter(r => r.status === 'not_found').length
            })
            // cede ao event loop
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, 10))
          }

          continue
        }

        // Real run (dryRun === false): query Supabase per user and apply updates
        if (!email || isNaN(points)) {
          processingResults.push({
            email: email || 'N/A',
            points: 0,
            status: 'failed',
            error: 'Email inválido ou pontos não informados'
          })
          setProcessedCount(i + 1)
          if (i % 50 === 0) {
            setResults([...processingResults])
            setSummary({
              success: processingResults.filter(r => r.status === 'success').length,
              failed: processingResults.filter(r => r.status === 'failed').length,
              notFound: processingResults.filter(r => r.status === 'not_found').length
            })
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, 10))
          }
          continue
        }

        // Buscar user_id pelo email
        // Normalize email to avoid hidden chars and casing issues
        const normalizeEmail = (raw: any) => {
          if (!raw) return ''
          let s = String(raw)
            .normalize('NFKC') // normalize unicode
            .replace(/\u200B|\uFEFF/g, '') // remove zero-width and BOM
            .trim()
            .toLowerCase()
          return s
        }

        const normalizedEmail = normalizeEmail(email)

        const { data: userData, error: userError } = await supabase
          .rpc('get_user_id_by_email', { user_email: normalizedEmail })

        // If still not found, try a fallback replacing a common typo domain 'hormail.com' -> 'hotmail.com'
        let finalUserData = userData
        let finalError = userError
        if ((!userData || !userData[0]?.get_user_id_by_email) && normalizedEmail.includes('hormail.com')) {
          const guessed = normalizedEmail.replace('hormail.com', 'hotmail.com')
          const { data: guessedData, error: guessedError } = await supabase
            .rpc('get_user_id_by_email', { user_email: guessed })
          if (guessedData && guessedData[0]?.get_user_id_by_email) {
            finalUserData = guessedData
            finalError = null
          }
        }

        if (finalError || !finalUserData || !finalUserData[0]?.get_user_id_by_email) {
          processingResults.push({
            email,
            points,
            status: 'not_found',
            error: 'Usuário não encontrado'
          })
          setProcessedCount(i + 1)
          if (i % 50 === 0) {
            setResults([...processingResults])
            setSummary({
              success: processingResults.filter(r => r.status === 'success').length,
              failed: processingResults.filter(r => r.status === 'failed').length,
              notFound: processingResults.filter(r => r.status === 'not_found').length
            })
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, 10))
          }
          continue
        }

        const userId = finalUserData[0].get_user_id_by_email

        // Buscar pontos atuais primeiro
        const { data: profile, error: fetchError } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', userId)
          .single()

        if (fetchError) {
          processingResults.push({
            email,
            userId,
            points,
            status: 'failed',
            error: fetchError.message
          })
          setProcessedCount(i + 1)
          if (i % 50 === 0) {
            setResults([...processingResults])
            setSummary({
              success: processingResults.filter(r => r.status === 'success').length,
              failed: processingResults.filter(r => r.status === 'failed').length,
              notFound: processingResults.filter(r => r.status === 'not_found').length
            })
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, 10))
          }
          continue
        }

        const currentPoints = profile?.points || 0

        // Adicionar pontos ao perfil (sem mudar o tier)
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ points: currentPoints + points })
          .eq('id', userId)

        if (updateError) {
          processingResults.push({
            email,
            userId,
            points,
            status: 'failed',
            error: updateError.message
          })
          setProcessedCount(i + 1)
          if (i % 50 === 0) {
            setResults([...processingResults])
            setSummary({
              success: processingResults.filter(r => r.status === 'success').length,
              failed: processingResults.filter(r => r.status === 'failed').length,
              notFound: processingResults.filter(r => r.status === 'not_found').length
            })
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, 10))
          }
          continue
        }

        // Adicionar entrada no histórico de fidelidade
        const { error: historyError } = await supabase
          .from('loyalty_history')
          .insert({
            user_id: userId,
            points: points,
            description: 'Bônus adicionado via importação',
            operation_type: 'bonus'
          })

        if (historyError) {
          console.error('Erro ao criar histórico:', historyError)
        }

        processingResults.push({
          email,
          userId,
          points,
          status: 'success'
        })

        // atualiza contadores e UI periodicamente
        if (i % 50 === 0 || i === rows.length - 1) {
          setResults([...processingResults])
          setProcessedCount(i + 1)
          setSummary({
            success: processingResults.filter(r => r.status === 'success').length,
            failed: processingResults.filter(r => r.status === 'failed').length,
            notFound: processingResults.filter(r => r.status === 'not_found').length
          })
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, 10))
        }

      }

      // Calcular resumo
      const summaryData = {
        success: processingResults.filter(r => r.status === 'success').length,
        failed: processingResults.filter(r => r.status === 'failed').length,
        notFound: processingResults.filter(r => r.status === 'not_found').length
      }

      setResults(processingResults)
      setSummary(summaryData)
      setProcessedCount(rows.length)

      toast({
        title: dryRun ? 'Simulação concluída' : 'Pontos adicionados com sucesso',
        description: dryRun 
          ? `${summaryData.success} usuários serão processados. Execute novamente para confirmar.`
          : `${summaryData.success} usuários receberam pontos com sucesso`
      })

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao processar arquivo',
        description: error.message
      })
    } finally {
      setProcessing(false)
    }
  }

  const downloadResults = () => {
    const csvContent = [
      ['Email', 'User ID', 'Pontos', 'Status', 'Erro'],
      ...results.map(r => [r.email, r.userId || '', r.points.toString(), r.status, r.error || ''])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'resultados_importacao_pontos.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const progressPercent = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Pontos em Massa</CardTitle>
          <CardDescription>
            Importe pontos de usuários a partir de um arquivo Excel. Os pontos serão adicionados sem alterar o status/tier do clube.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {totalCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div>Processados: {processedCount} / {totalCount}</div>
                <div>{progressPercent}%</div>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-md overflow-hidden">
                <div className="h-2 bg-green-500 rounded-md" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          )}

          {preview.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Pré-visualização (primeiras 10 linhas)</h3>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(preview[0]).map((key) => (
                        <TableHead key={key}>{key}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, index) => (
                      <TableRow key={index}>
                        {Object.values(row).map((value: any, i) => (
                          <TableCell key={i}>{String(value)}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {file && (
            <div className="flex gap-2">
              <Button
                onClick={() => processBulkAddPoints(true)}
                disabled={processing}
                variant="outline"
              >
                {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Simular Importação
              </Button>
              <Button
                onClick={() => processBulkAddPoints(false)}
                disabled={processing || !summary || summary.success === 0}
              >
                {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Confirmar e Adicionar Pontos
              </Button>
            </div>
          )}

          {summary && (
            <Card>
              <CardHeader>
                <CardTitle>Resumo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{summary.success}</div>
                    <div className="text-sm text-gray-600">Sucesso</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
                    <div className="text-sm text-gray-600">Falhas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{summary.notFound}</div>
                    <div className="text-sm text-gray-600">Não encontrados</div>
                  </div>
                </div>
                {results.length > 0 && (
                  <Button
                    onClick={downloadResults}
                    variant="outline"
                    className="mt-4"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Baixar Resultados
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {results.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Resultados Detalhados</h3>
              <div className="border rounded-md overflow-x-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {result.status === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                          {result.status === 'failed' && <AlertCircle className="h-4 w-4 text-red-600" />}
                          {result.status === 'not_found' && <AlertCircle className="h-4 w-4 text-yellow-600" />}
                        </TableCell>
                        <TableCell>{result.email}</TableCell>
                        <TableCell>{result.userId || '-'}</TableCell>
                        <TableCell>{result.points}</TableCell>
                        <TableCell>{result.error || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}