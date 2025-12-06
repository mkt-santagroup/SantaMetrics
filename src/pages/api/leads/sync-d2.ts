import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { startOfDay, endOfDay, subDays, isSameDay } from 'date-fns';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SANTA_API_TOKEN = 'Mjk5ODk4OiZTWk0zM1FxOGtaJDWA231XFXZ';
const API_BASE = 'http://api.santagroup.com.br:4957';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body; 

  try {
    const now = new Date();

    // =================================================================================
    // AÇÃO 1: INGESTÃO (Salva novos)
    // =================================================================================
    if (action === 'ingest') {
      const todayBrazilStr = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(now).split('/').reverse().join('-');

      console.log(`🇧🇷 [INGEST] Data Base: ${todayBrazilStr}`);

      const ingestRes = await fetch(`${API_BASE}/get-day-plus-data?start_date=${todayBrazilStr}&days=1`, {
        headers: { 'Authorization': SANTA_API_TOKEN, 'Content-Type': 'application/json' }
      });

      let novosInseridos = 0;

      if (ingestRes.ok) {
        const rawData = await ingestRes.json();
        const apiLeads = Array.isArray(rawData) ? rawData : [rawData];

        const startOfToday = startOfDay(now).toISOString();
        const endOfToday = endOfDay(now).toISOString();

        const { data: leadsDeHoje } = await supabase
          .from('CALL_LEADS_D2')
          .select('passport')
          .gte('created_at', startOfToday)
          .lte('created_at', endOfToday);

        const passportsHoje = new Set(leadsDeHoje?.map(l => l.passport));
        const inserts = [];

        for (const player of apiLeads) {
          if (!passportsHoje.has(player.passport)) {
            inserts.push({
              passport: player.passport,
              name: player.name || player.realName || 'Desconhecido',
              whatsapp: player.whatsapp,
              time_played: player.timePlayed,
              first_spawn: player.firstspawn,
              last_login_at_ingestion: player.lastLogin,
              current_last_login: null,
              status: 'PENDING',
              is_recovered: false,
              recovery_type: null
            });
          }
        }

        if (inserts.length > 0) {
          await supabase.from('CALL_LEADS_D2').insert(inserts);
          novosInseridos = inserts.length;
        }
      }

      return res.status(200).json({ success: true, message: 'Ingestão OK', novos: novosInseridos });
    }

    // =================================================================================
    // AÇÃO 2: ATUALIZAR (Correção do Fuso Aplicada)
    // =================================================================================
    else if (action === 'update') {
      console.log('🔎 [UPDATE] Iniciando varredura...');

      const sevenDaysAgo = subDays(now, 7).toISOString();
      
      const { data: pendentes } = await supabase
        .from('CALL_LEADS_D2')
        .select('*')
        .eq('is_recovered', false)
        .gte('created_at', sevenDaysAgo);

      let recuperadosCount = 0;

      if (pendentes && pendentes.length > 0) {
        const uniquePassports = [...new Set(pendentes.map(p => p.passport))];
        
        const infoRes = await fetch(`${API_BASE}/get-players-info`, {
          method: 'POST',
          headers: { 'Authorization': SANTA_API_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({ players: uniquePassports })
        });

        if (infoRes.ok) {
          const infos = await infoRes.json();
          const infosMap = new Map(infos.map((i: any) => [i.passport, i]));

          for (const chamado of pendentes) {
            const infoAtual = infosMap.get(chamado.passport);
            
            if (infoAtual) {
              // 1. DATA DO BANCO (Já está em UTC, ex: ...+00:00)
              const dbTime = new Date(chamado.last_login_at_ingestion).getTime();

              // 2. DATA DA API (String "pelada", ex: 2025-12-03T23:59:15)
              // CORREÇÃO CRÍTICA: Se não tiver 'Z' nem '+', adicionamos 'Z' para forçar UTC.
              // --- CORREÇÃO 1 AQUI ---
              let apiString = (infoAtual as any).lastLogin;
              
              if (!apiString.endsWith('Z') && !apiString.includes('+')) {
                  apiString += 'Z'; 
              }
              const apiTime = new Date(apiString).getTime();

              // 3. CALCULA DIFERENÇA
              const diff = apiTime - dbTime;

              // REGRA DE OURO + TOLERÂNCIA DE 60s
              // Se diff for 0 (iguais), não entra.
              // Se diff for pequeno (segundos de delay), não entra.
              if (diff > 60000) { 
                console.log(`✅ RECUPERADO REAL: #${chamado.passport} | DB: ${chamado.last_login_at_ingestion} -> API: ${(infoAtual as any).lastLogin}`);

                let type = 'ORGANIC';
                if (chamado.called_at) {
                  const callDate = new Date(chamado.called_at);
                  const loginDate = new Date(apiString); // Usa a string corrigida
                  
                  if (apiTime < callDate.getTime()) type = 'ORGANIC';
                  else if (isSameDay(callDate, loginDate)) type = 'SAME_DAY';
                  else type = 'LATE';
                }

                await supabase
                  .from('CALL_LEADS_D2')
                  .update({
                    // --- CORREÇÃO 2 AQUI ---
                    current_last_login: (infoAtual as any).lastLogin,
                    is_recovered: true,
                    status: 'RECOVERED',
                    recovery_type: type,
                    updated_at: new Date()
                  })
                  .eq('id', chamado.id);
                
                recuperadosCount++;
              }
            }
          }
        }
      }

      return res.status(200).json({ success: true, message: 'Atualização OK', recuperados: recuperadosCount });
    }

    else {
      return res.status(400).json({ error: 'Ação inválida.' });
    }

  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}