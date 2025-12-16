import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// --- CONFIGURAÇÕES ---
const DISPARO_TOKEN = '80bfd6e25aeca5f05b456dd186fa29455411a11a';
const AUDIO_ID = 'a3d4342b-b11b-4166-9062-bc57e0ba9c73';
const COMTELE_KEY = '4b20f8a0-f59e-44a0-9d86-0c866934cbfd';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lead_id, phone, name, send_sms, sms_content } = req.body;

  // Proteção básica: Só reclama se não tiver telefone. O ID pode ser 0 ou null.
  if (!phone) {
      return res.status(400).json({ error: 'Telefone é obrigatório.' });
  }

  try {
    // 1. LIMPEZA DO TELEFONE
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

    // Detecta se é modo manual (ID 0 ou 999999 ou nulo)
    // Se for manual, setamos uma flag para pular o banco de dados
    const isManual = !lead_id || lead_id == 0 || lead_id == 999999;

    console.log(`🚀 [CALL] Iniciando... Lead: ${name || 'Manual'} | ID: ${lead_id} | Tel: ${cleanPhone} | Modo: ${isManual ? 'MANUAL (Sem DB)' : 'AUTOMÁTICO'}`);

    // =================================================================================
    // 2. FAZER A LIGAÇÃO (DISPARO PRO)
    // =================================================================================
    const callRes = await fetch('https://gateway.disparopro.com.br/voice/v1/call/send', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'token': DISPARO_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: cleanPhone,
        type: 'audio',
        audio_id: AUDIO_ID
      })
    });

    const callData = await callRes.json();
    const callId = callData.id || callData.data?.id; 

    if (!callRes.ok || !callId) {
      throw new Error(`Erro ao ligar: ${JSON.stringify(callData)}`);
    }

    console.log(`📞 Ligação efetuada (ID: ${callId}). Aguardando 60s...`);

    // =================================================================================
    // 3. ESPERAR 60 SEGUNDOS
    // =================================================================================
    await sleep(60000); 

    // =================================================================================
    // 4. CONSULTAR STATUS DA LIGAÇÃO (Opcional no manual, mas bom pra log)
    // =================================================================================
    let finalStatus = 'UNKNOWN';
    let finalPrice = 0;

    try {
        const statusRes = await fetch(`https://gateway.disparopro.com.br/voice/v1/call?id=${callId}`, {
          method: 'GET',
          headers: { 'token': DISPARO_TOKEN }
        });
        const statusJson = await statusRes.json();
        const callItem = statusJson.items ? statusJson.items[0] : (statusJson.data || statusJson);
        finalStatus = callItem?.status_call || callItem?.status || 'UNKNOWN';
        finalPrice = callItem?.price || 0;
        console.log(`🔎 Status Ligação: ${finalStatus}`);
    } catch (e) {
        console.error('Erro ao consultar status (não crítico):', e);
    }

    // =================================================================================
    // 5. ENVIAR SMS (COMTELE)
    // =================================================================================
    if (send_sms && sms_content) {
        try {
            const smsPayload = {
                Receivers: `+${cleanPhone}`, 
                Content: sms_content
            };
            
            console.log(`📤 Enviando SMS...`);
            
            const smsRes = await fetch('https://sms.comtele.com.br/api/v2/send', {
                method: 'POST',
                headers: {
                    'auth-key': COMTELE_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(smsPayload)
            });

            const smsText = await smsRes.text();
            console.log(`✅ Resposta SMS: ${smsText}`);

        } catch (smsErr) {
            console.error('Erro no envio de SMS:', smsErr);
        }
    } else {
        console.log(`🔕 SMS não solicitado.`);
    }

    // =================================================================================
    // 6. ATUALIZAR DB (APENAS SE NÃO FOR MANUAL)
    // =================================================================================
    if (!isManual) {
        // Tenta atualizar, mas se der erro de "lead não encontrado", não quebra a requisição
        try {
            const { data: currentLead, error: fetchError } = await supabase
                .from('CALL_LEADS_D2')
                .select('call_count, call_history')
                .eq('id', lead_id)
                .single();

            if (!fetchError && currentLead) {
                const currentCount = (currentLead.call_count || 0) + 1;
                let currentHistory = currentLead.call_history;
                if (!Array.isArray(currentHistory)) currentHistory = [];

                const newHistoryEntry = {
                    call_number: currentCount,
                    date: new Date().toISOString(),
                    call_id: callId,
                    status: finalStatus,
                    price: finalPrice,
                    sms_sent: !!(send_sms && sms_content)
                };

                await supabase
                    .from('CALL_LEADS_D2')
                    .update({
                        call_count: currentCount,
                        call_history: [...currentHistory, newHistoryEntry], 
                        status: 'CALLED',
                        called_at: new Date()
                    })
                    .eq('id', lead_id);
            } else {
                console.log(`⚠️ Lead ID ${lead_id} não encontrado no banco. Pulando update.`);
            }
        } catch (dbErr) {
            console.error('Erro ao atualizar banco (ignorado):', dbErr);
        }
    } else {
        console.log('🛑 Modo Manual: Nenhuma alteração feita no banco de dados.');
    }

    return res.status(200).json({ 
      success: true, 
      last_status: finalStatus 
    });

  } catch (err: any) {
    console.error('Erro CRÍTICO:', err);
    return res.status(500).json({ error: err.message });
  }
}