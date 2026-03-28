// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('[bulk-add-points] request received', req.method)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.text()
    const payload = body ? JSON.parse(body) : null
    const rows = Array.isArray(payload?.rows) ? payload.rows : []

    console.log('[bulk-add-points] processing rows count=', rows.length)

    const results: any[] = []

    for (const row of rows) {
      try {
        const emailRaw = row.email
        const points = Number(row.points) || 0
        const email = String(emailRaw ?? '').normalize('NFKC').replace(/\u200B|\uFEFF/g, '').trim().toLowerCase()

        if (!email || isNaN(points)) {
          results.push({ email: emailRaw, points, status: 'failed', error: 'Email inválido ou pontos inválidos' })
          continue
        }

        // Use RPC to get user id
        const { data: userData, error: userError } = await supabase.rpc('get_user_id_by_email', { user_email: email })
        if (userError || !userData || !userData[0]?.get_user_id_by_email) {
          // try common typo fallback
          let found = false
          if (email.includes('hormail.com')) {
            const alt = email.replace('hormail.com', 'hotmail.com')
            const { data: guessedData, error: guessedErr } = await supabase.rpc('get_user_id_by_email', { user_email: alt })
            if (!guessedErr && guessedData && guessedData[0]?.get_user_id_by_email) {
              // set email to corrected
              const userId = guessedData[0].get_user_id_by_email
              // update profile points
              const { error: upErr } = await supabase.from('profiles').update({ points: supabase.raw(`points + ${points}`) }).eq('id', userId)
              // insert history
              await supabase.from('loyalty_history').insert({ user_id: userId, points, description: 'Bônus adicionado via importação (domínio corrigido)', operation_type: 'bonus' })
              results.push({ email: emailRaw, correctedEmail: alt, userId, points, status: 'success' })
              found = true
            }
          }

          if (!found) {
            results.push({ email: emailRaw, points, status: 'not_found' })
          }
          continue
        }

        const userId = userData[0].get_user_id_by_email

        // Get current points to check if update is needed
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', userId)
          .single()

        if (profileError || !profile) {
          console.error('[bulk-add-points] fetch profile error', { email, userId, error: profileError })
          results.push({ email: emailRaw, userId, points, status: 'failed', error: 'Erro ao buscar perfil' })
          continue
        }

        const currentPoints = profile.points ?? 0
        // Skip if points are already equal to import value
        if (currentPoints === points) {
          results.push({ email: emailRaw, userId, points, status: 'skipped', reason: 'Pontos já são iguais' })
          continue
        }

        // Update points using service role key (bypasses RLS)
        const { error: updateError } = await supabase.from('profiles').update({ points: supabase.raw(`points + ${points}`) }).eq('id', userId)
        if (updateError) {
          console.error('[bulk-add-points] update error', { email, userId, error: updateError })
          results.push({ email: emailRaw, userId, points, status: 'failed', error: updateError.message })
          continue
        }

        const { error: historyError } = await supabase.from('loyalty_history').insert({ user_id: userId, points, description: 'Bônus adicionado via importação', operation_type: 'bonus' })
        if (historyError) {
          console.error('[bulk-add-points] history insert error', { email, userId, error: historyError })
        }

        results.push({ email: emailRaw, userId, points, status: 'success' })

      } catch (err) {
        console.error('[bulk-add-points] row error', err)
        results.push({ email: row.email, points: row.points, status: 'failed', error: err.message })
      }
    }

    const summary = {
      success: results.filter(r => r.status === 'success').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      failed: results.filter(r => r.status === 'failed').length,
      notFound: results.filter(r => r.status === 'not_found').length
    }

    return new Response(JSON.stringify({ success: true, results, summary }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[bulk-add-points] error', error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})