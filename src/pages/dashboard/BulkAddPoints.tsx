import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, Loader2, CheckCircle, AlertCircle, Download, RefreshCw, ArrowRight, Info } from 'lucide-react'
import { read, utils } from 'xlsx'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ─── tipos ────────────────────────────────────────────────────────────────────

type RowStatus = 'will_replace' | 'will_add' | 'not_found' | 'invalid'

interface PreviewRow {
  email: string
  newPoints: number
  currentPoints: number
  userId: string | null
  status: RowStatus
  error?: string
}

interface FinalResult {
  email: string
  userId?: string
  newPoints: number
  status: 'success' | 'failed' | 'not_found' | 'invalid'
  error?: string
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const normalizeEmail = (raw: unknown): string => {
  if (!raw) return ''
  return String(raw)
    .normalize('NFKC')
    .replace(/\u200B|\uFEFF/g, '')
    .trim()
    .toLowerCase()
}

const resolveUserId = (d: unknown): string | null => {
  if (!d) return null
  if (typeof d === 'string') return d
  if (typeof d === 'object' && !Array.isArray(d)) {
    const obj = d as Record<string, unknown>
    if (typeof obj.get_user_id_by_email === 'string') return obj.get_user_id_by_email
    const keys = Object.keys(obj)
    if (keys.length === 1 && typeof obj[keys[0]] === 'string') return obj[keys[0]] as string
    return null
  }
  if (Array.isArray(d) && d.length > 0) {
    const first = d[0]
    if (!first) return null
    if (typeof first === 'string') return first
    const keys = Object.keys(first as object)
    if (keys.length > 0 && typeof (first as Record<string, unknown>)[keys[0]] === 'string')
      return (first as Record<string, unknown>)[keys[0]] as string
  }
  return null
}

const extractRowFields = (row: Record<string, unknown>) => {
  const email =
    row['email'] ?? row['Email'] ?? row['EMAIL'] ?? row['E-mail'] ?? row['E-MAIL'] ?? ''
  const rawPoints =
    row['pontos'] ?? row['Pontos'] ?? row['PONTOS'] ?? row['ponto'] ?? row['Ponto'] ??
    row['ponto(s)'] ?? row['Ponto(s)'] ?? '0'
  const points = parseInt(String(rawPoints).replace(/[^0-9-]/g, ''), 10)
  return { email: normalizeEmail(email), points }
}

// ─── componente ───────────────────────────────────────────────────────────────

export default function BulkAddPoints() {
  const { toast } = useToast()

  const [file, setFile] = useState<File | null>(null)
  const [fileRowCount, setFileRowCount] = useState(0)
  const [filePreview, setFilePreview] = useState<Record<string, unknown>[]>([])

  // fase 1: análise (dry-run real)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState(0)
  const [analyzeTotal, setAnalyzeTotal] = useState(0)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [analyzed, setAnalyzed] = useState(false)

  // fase 2: confirmação
  const [showConfirm, setShowConfirm] = useState(false)

  // fase 3: importação real
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importTotal, setImportTotal] = useState(0)
  const [finalResults, setFinalResults] = useState<FinalResult[]>([])
  const [imported, setImported] = useState(false)

  // ── leitura do arquivo ──────────────────────────────────────────────────────

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFile(selected)
    setAnalyzed(false)
    setImported(false)
    setPreviewRows([])
    setFinalResults([])

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb = read(data, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows = utils.sheet_to_json(sheet) as Record<string, unknown>[]
        setFileRowCount(rows.length)
        setFilePreview(rows.slice(0, 5))
        toast({ title: 'Arquivo carregado', description: `${rows.length} linhas encontradas` })
      } catch {
        toast({ variant: 'destructive', title: 'Erro ao ler arquivo', description: 'Verifique se é um .xlsx válido' })
      }
    }
    reader.readAsArrayBuffer(selected)
  }

  // ── fase 1: análise real (consulta Supabase) ────────────────────────────────

  const runAnalysis = async () => {
    if (!file) return
    setAnalyzing(true)
    setAnalyzed(false)
    setPreviewRows([])

    try {
      const data = await file.arrayBuffer()
      const wb = read(data, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = utils.sheet_to_json(sheet) as Record<string, unknown>[]

      setAnalyzeTotal(rows.length)
      const results: PreviewRow[] = []

      for (let i = 0; i < rows.length; i++) {
        const { email, points } = extractRowFields(rows[i])

        if (!email || isNaN(points) || points < 0) {
          results.push({
            email: email || 'N/A',
            newPoints: points || 0,
            currentPoints: 0,
            userId: null,
            status: 'invalid',
            error: !email ? 'Email ausente' : isNaN(points) ? 'Pontos inválidos' : 'Pontos negativos não permitidos',
          })
          setAnalyzeProgress(i + 1)
          continue
        }

        // busca userId
        const { data: uid } = await supabase.rpc('get_user_id_by_email', { user_email: email })
        let userId = resolveUserId(uid)

        // fallback typo hormail → hotmail
        if (!userId && email.includes('hormail.com')) {
          const fixed = email.replace('hormail.com', 'hotmail.com')
          const { data: uid2 } = await supabase.rpc('get_user_id_by_email', { user_email: fixed })
          userId = resolveUserId(uid2)
        }

        if (!userId) {
          results.push({ email, newPoints: points, currentPoints: 0, userId: null, status: 'not_found', error: 'Usuário não encontrado' })
          setAnalyzeProgress(i + 1)
          if (i % 20 === 0) await new Promise(r => setTimeout(r, 0))
          continue
        }

        // busca pontos atuais
        const { data: profile } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', userId)
          .single()

        const currentPoints = (profile as { points?: number } | null)?.points ?? 0

        results.push({
          email,
          newPoints: points,
          currentPoints,
          userId,
          status: currentPoints > 0 ? 'will_replace' : 'will_add',
        })

        setAnalyzeProgress(i + 1)
        if (i % 20 === 0) {
          setPreviewRows([...results])
          await new Promise(r => setTimeout(r, 0))
        }
      }

      setPreviewRows(results)
      setAnalyzed(true)
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erro na análise', description: (err as Error).message })
    } finally {
      setAnalyzing(false)
    }
  }

  // ── fase 2: importação real ─────────────────────────────────────────────────

  const runImport = async () => {
    setShowConfirm(false)
    setImporting(true)
    setImported(false)
    setFinalResults([])

    const toProcess = previewRows.filter(r => r.status === 'will_replace' || r.status === 'will_add')
    setImportTotal(toProcess.length)

    const results: FinalResult[] = []

    // Adiciona de imediato os inválidos e não encontrados ao resultado final
    for (const r of previewRows) {
      if (r.status === 'invalid' || r.status === 'not_found') {
        results.push({
          email: r.email,
          newPoints: r.newPoints,
          status: r.status === 'invalid' ? 'invalid' : 'not_found',
          error: r.error,
        })
      }
    }

    for (let i = 0; i < toProcess.length; i++) {
      const row = toProcess[i]

      // SET direto com o valor da planilha (substitui ou adiciona — mesmo UPDATE)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ points: row.newPoints })
        .eq('id', row.userId!)

      if (updateError) {
        results.push({ email: row.email, userId: row.userId!, newPoints: row.newPoints, status: 'failed', error: updateError.message })
        setImportProgress(i + 1)
        continue
      }

      // Histórico de fidelidade
      const description =
        row.status === 'will_replace'
          ? `Pontos atualizados via importação em massa (anterior: ${row.currentPoints})`
          : 'Pontos adicionados via importação em massa'

      const { error: histError } = await supabase.from('loyalty_history').insert({
        user_id: row.userId!,
        points: row.newPoints,
        description,
        operation_type: 'bonus',
      })

      if (histError) {
        console.error('[BulkAddPoints] erro ao gravar histórico:', histError.message)
      }

      results.push({ email: row.email, userId: row.userId!, newPoints: row.newPoints, status: 'success' })
      setImportProgress(i + 1)

      if (i % 20 === 0) {
        setFinalResults([...results])
        await new Promise(r => setTimeout(r, 0))
      }
    }

    setFinalResults(results)
    setImported(true)
    setImporting(false)

    const successCount = results.filter(r => r.status === 'success').length
    toast({ title: 'Importação concluída', description: `${successCount} clientes atualizados com sucesso` })
  }

  // ── download CSV ────────────────────────────────────────────────────────────

  const downloadResults = () => {
    const csv = [
      ['Email', 'User ID', 'Novos Pontos', 'Status', 'Erro'],
      ...finalResults.map(r => [r.email, r.userId ?? '', r.newPoints.toString(), r.status, r.error ?? '']),
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'resultado_importacao_pontos.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── contadores do resumo de análise ────────────────────────────────────────

  const countReplace = previewRows.filter(r => r.status === 'will_replace').length
  const countAdd = previewRows.filter(r => r.status === 'will_add').length
  const countNotFound = previewRows.filter(r => r.status === 'not_found').length
  const countInvalid = previewRows.filter(r => r.status === 'invalid').length
  const countOk = countReplace + countAdd

  const analyzePercent = analyzeTotal > 0 ? Math.round((analyzeProgress / analyzeTotal) * 100) : 0
  const importPercent = importTotal > 0 ? Math.round((importProgress / importTotal) * 100) : 0

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Card principal ── */}
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Pontos em Massa</CardTitle>
          <CardDescription>
            Importe uma planilha Excel com colunas <strong>email</strong> e <strong>pontos</strong>.
            Se o cliente já tiver pontos, o valor será <strong>substituído</strong>. Se não tiver, será <strong>adicionado</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Upload */}
          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={analyzing || importing}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                📄 <strong>{file.name}</strong> — {fileRowCount} linhas
              </p>
            )}
          </div>

          {/* Preview rápido do arquivo */}
          {filePreview.length > 0 && !analyzed && (
            <div>
              <p className="text-sm font-medium mb-2 text-muted-foreground">Prévia do arquivo (5 primeiras linhas)</p>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(filePreview[0]).map(k => <TableHead key={k}>{k}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filePreview.map((row, i) => (
                      <TableRow key={i}>
                        {Object.values(row).map((v, j) => <TableCell key={j}>{String(v)}</TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Botão Analisar */}
          {file && !analyzed && (
            <Button onClick={runAnalysis} disabled={analyzing} className="w-full sm:w-auto">
              {analyzing
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando…</>
                : <><Upload className="mr-2 h-4 w-4" /> Analisar Planilha</>}
            </Button>
          )}

          {/* Barra de progresso da análise */}
          {analyzing && analyzeTotal > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Analisando: {analyzeProgress} / {analyzeTotal}</span>
                <span>{analyzePercent}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-2 bg-blue-500 rounded-full transition-all" style={{ width: `${analyzePercent}%` }} />
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      {/* ── Resumo da análise ── */}
      {analyzed && previewRows.length > 0 && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-500" />
              Resumo da Análise
            </CardTitle>
            <CardDescription>
              Revise o que acontecerá antes de confirmar a importação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Cards de contagem */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border bg-green-50 p-4 text-center">
                <div className="text-3xl font-bold text-green-700">{countOk}</div>
                <div className="text-sm text-green-600 mt-1">Serão processados</div>
              </div>
              <div className="rounded-lg border bg-orange-50 p-4 text-center">
                <div className="text-3xl font-bold text-orange-600">{countReplace}</div>
                <div className="text-sm text-orange-500 mt-1">Pontos substituídos</div>
              </div>
              <div className="rounded-lg border bg-blue-50 p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{countAdd}</div>
                <div className="text-sm text-blue-500 mt-1">Pontos adicionados</div>
              </div>
              <div className="rounded-lg border bg-red-50 p-4 text-center">
                <div className="text-3xl font-bold text-red-600">{countNotFound + countInvalid}</div>
                <div className="text-sm text-red-500 mt-1">Ignorados</div>
              </div>
            </div>

            {/* Tabela detalhada */}
            <div>
              <p className="text-sm font-medium mb-2">Detalhes por cliente</p>
              <div className="border rounded-md overflow-x-auto max-h-80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ação</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Pontos atuais</TableHead>
                      <TableHead className="text-center">→</TableHead>
                      <TableHead className="text-right">Novos pontos</TableHead>
                      <TableHead>Obs.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, i) => (
                      <TableRow key={i} className={row.status === 'invalid' || row.status === 'not_found' ? 'opacity-50' : ''}>
                        <TableCell>
                          {row.status === 'will_replace' && <Badge variant="outline" className="border-orange-400 text-orange-600 bg-orange-50">Substituir</Badge>}
                          {row.status === 'will_add' && <Badge variant="outline" className="border-blue-400 text-blue-600 bg-blue-50">Adicionar</Badge>}
                          {row.status === 'not_found' && <Badge variant="outline" className="border-yellow-400 text-yellow-600 bg-yellow-50">Não encontrado</Badge>}
                          {row.status === 'invalid' && <Badge variant="outline" className="border-red-400 text-red-600 bg-red-50">Inválido</Badge>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.email}</TableCell>
                        <TableCell className="text-right font-medium">
                          {row.status === 'will_replace' || row.status === 'will_add' ? row.currentPoints : '—'}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {(row.status === 'will_replace' || row.status === 'will_add') && <ArrowRight className="h-3 w-3 inline" />}
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-700">
                          {row.status === 'will_replace' || row.status === 'will_add' ? row.newPoints : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.error ?? ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Ações */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => { setAnalyzed(false); setPreviewRows([]) }}
                disabled={importing}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reanalisar
              </Button>
              <Button
                onClick={() => setShowConfirm(true)}
                disabled={importing || countOk === 0}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirmar e Importar {countOk} clientes
              </Button>
            </div>

          </CardContent>
        </Card>
      )}

      {/* ── Progresso da importação ── */}
      {importing && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Importando: {importProgress} / {importTotal}</span>
              <span>{importPercent}%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-3 bg-green-500 rounded-full transition-all" style={{ width: `${importPercent}%` }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Resultado final ── */}
      {imported && finalResults.length > 0 && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              Importação Concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-green-50 p-4 text-center">
                <div className="text-3xl font-bold text-green-700">{finalResults.filter(r => r.status === 'success').length}</div>
                <div className="text-sm text-green-600 mt-1">Sucesso</div>
              </div>
              <div className="rounded-lg border bg-red-50 p-4 text-center">
                <div className="text-3xl font-bold text-red-600">{finalResults.filter(r => r.status === 'failed').length}</div>
                <div className="text-sm text-red-500 mt-1">Falhas</div>
              </div>
              <div className="rounded-lg border bg-yellow-50 p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600">{finalResults.filter(r => r.status === 'not_found').length}</div>
                <div className="text-sm text-yellow-500 mt-1">Não encontrados</div>
              </div>
            </div>

            <Button variant="outline" onClick={downloadResults}>
              <Download className="mr-2 h-4 w-4" />
              Baixar Relatório CSV
            </Button>

            <div className="border rounded-md overflow-x-auto max-h-80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Pontos</TableHead>
                    <TableHead>Obs.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finalResults.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {r.status === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                        {r.status === 'failed' && <AlertCircle className="h-4 w-4 text-red-600" />}
                        {r.status === 'not_found' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                        {r.status === 'invalid' && <AlertCircle className="h-4 w-4 text-gray-400" />}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.email}</TableCell>
                      <TableCell className="text-right font-medium">{r.newPoints}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.error ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Dialog de confirmação ── */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar importação de pontos?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>Você está prestes a aplicar as seguintes alterações:</p>
                <ul className="space-y-1 pl-4 list-disc">
                  {countReplace > 0 && (
                    <li>
                      <span className="font-semibold text-orange-600">{countReplace} clientes</span> terão seus pontos <strong>substituídos</strong> pelo valor da planilha.
                    </li>
                  )}
                  {countAdd > 0 && (
                    <li>
                      <span className="font-semibold text-blue-600">{countAdd} clientes</span> terão pontos <strong>adicionados</strong> (atualmente com 0).
                    </li>
                  )}
                  {(countNotFound + countInvalid) > 0 && (
                    <li className="text-muted-foreground">
                      {countNotFound + countInvalid} linhas serão ignoradas (não encontradas ou inválidas).
                    </li>
                  )}
                </ul>
                <p className="text-red-600 font-medium">⚠️ Esta ação não pode ser desfeita.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={runImport} className="bg-green-600 hover:bg-green-700">
              Sim, importar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
