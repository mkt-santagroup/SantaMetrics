import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { startOfDay, endOfDay, subDays, isSameDay } from 'date-fns';

// Configurações
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SANTA_API_TOKEN = 'Mjk5ODk4OiZTWk0zM1FxOGtaJDWA231XFXZ';
const API_BASE = 'http://api.santagroup.com.br:4957';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // -------------------------------------------------------------------------
    // PREPARAÇÃO DE DATAS
    // -------------------------------------------------------------------------
    const now = new Date();
    
    // Data String para a API do Santa (YYYY-MM-DD no fuso Brasil)
    const todayStr = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now).split('/').reverse().join('-');

    // Intervalos para consulta no Supabase (UTC)
    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();
    const sevenDaysAgo = subDays(now, 7).toISOString();

    console.log(`🇧🇷 [SYNC] Iniciando sync para data: ${todayStr}`);

    // =================================================================================
    // 1. INGESTÃO: Busca na API e Salva NOVIDADES do dia (current_last_login = NULL)
    // =================================================================================
    
    // Pega leads do dia na API (days=1 foca no dia solicitado)
    const ingestRes = await fetch(`${API_BASE}/get-day-plus-data?start_date=${todayStr}&days=1`, {
      headers: { 'Authorization': SANTA_API_TOKEN, 'Content-Type': 'application/json' }
    });
    
    let novosInseridos = 0;
    
    if (ingestRes.ok) {
      const rawData = await ingestRes.json();
      const apiLeads = Array.isArray(rawData) ? rawData : [rawData];

      // Pega passports já inseridos HOJE no banco para não duplicar
      const { data: leadsDeHoje } = await supabase
        .from('CALL_LEADS_D2')
        .select('passport')
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd);

      const passportsCadastradosHoje = new Set(leadsDeHoje?.map(l => l.passport));
      const inserts = [];

      for (const player of apiLeads) {
        // Se este passaporte ainda não foi cadastrado hoje
        if (!passportsCadastradosHoje.has(player.passport)) {
          inserts.push({
            passport: player.passport,
            name: player.name || player.realName || 'Desconhecido',
            whatsapp: player.whatsapp,
            time_played: player.timePlayed,
            first_spawn: player.firstspawn,
            
            // O REF: O momento exato que o sistema "viu" ele pela primeira vez no dia
            last_login_at_ingestion: player.lastLogin,
            
            // O ALVO: Nasce NULO. Só será preenchido se ele logar DEPOIS dessa ingestão.
            current_last_login: null,
            
            status: 'PENDING',
            is_recovered: false,
            recovery_type: null
          });
        }
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from('CALL_LEADS_D2').insert(inserts);
        if (error) {
          console.error("❌ Erro no insert:", error);
        } else {
          novosInseridos = inserts.length;
          console.log(`📥 [INGESTÃO] ${novosInseridos} novos leads inseridos.`);
        }
      }
    } else {
      console.warn("⚠️ API de Ingestão retornou erro ou vazio.");
    }

    // =================================================================================
    // 2. MONITORAMENTO: Verifica leads de 7 dias atrás que ainda não recuperaram
    // =================================================================================

    // Busca leads criados nos últimos 7 dias que AINDA NÃO recuperaram (is_recovered = false)
    const { data: pendentes } = await supabase
      .from('CALL_LEADS_D2')
      .select('*')
      .gte('created_at', sevenDaysAgo)
      .eq('is_recovered', false); // Otimização: Só verifica quem ainda tá pendente

    let recuperadosCount = 0;

    if (pendentes && pendentes.length > 0) {
      // Cria lista de IDs para a API
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
                // DATA DO BANCO (Congelada na ingestão)
                const dbTime = new Date(chamado.last_login_at_ingestion).getTime();
                // DATA DA API (Agora)
                const apiTime = new Date(infoAtual.lastLogin).getTime();

                // >>> A LÓGICA CRÍTICA <<<
                // Só atualiza se a data da API for ESTRITAMENTE MAIOR que a do banco
                if (apiTime > dbTime) {
                    console.log(`✅ RECUPERADO: Passport ${chamado.passport} | DB: ${chamado.last_login_at_ingestion} -> API: ${infoAtual.lastLogin}`);

                    // Lógica de Tipo de Recuperação
                    let type = 'ORGANIC';
                    if (chamado.called_at) {
                        const callDate = new Date(chamado.called_at);
                        const loginDate = new Date(infoAtual.lastLogin);
                        
                        // Se logou antes da call -> Orgânico (já tinha voltado)
                        if (apiTime < callDate.getTime()) type = 'ORGANIC';
                        // Se logou no mesmo dia da call -> Same Day
                        else if (isSameDay(callDate, loginDate)) type = 'SAME_DAY';
                        // Se logou dias depois -> Late
                        else type = 'LATE';
                    } else {
                        // Se não teve ligação mas voltou, é Orgânico
                        type = 'ORGANIC'; 
                    }

                    // Atualiza o banco
                    await supabase
                        .from('CALL_LEADS_D2')
                        .update({
                            current_last_login: infoAtual.lastLogin,
                            is_recovered: true,
                            status: 'RECOVERED',
                            recovery_type: type,
                            updated_at: new Date()
                        })
                        .eq('id', chamado.id);

                    recuperadosCount++;
                }
                // SE FOR IGUAL (apiTime === dbTime), NÃO FAZ NADA.
            }
        }
      }
    }

    return res.status(200).json({
      success: true,
      novos_banco: novosInseridos,
      verificados_pendentes: pendentes?.length || 0,
      novos_recuperados: recuperadosCount
    });

  } catch (err: any) {
    console.error("🔥 Erro Fatal:", err);
    return res.status(500).json({ error: err.message });
  }
}