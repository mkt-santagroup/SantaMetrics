import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// --- CONFIGURAÇÕES ---
// Ligação (Disparo Pro)
const DISPARO_TOKEN = '80bfd6e25aeca5f05b456dd186fa29455411a11a'; // Ideal: process.env.DISPARO_TOKEN
const AUDIO_ID = 'a3d4342b-b11b-4166-9062-bc57e0ba9c73';

// SMS (Comtele)
const COMTELE_KEY = '4b20f8a0-f59e-44a0-9d86-0c866934cbfd'; // Ideal: process.env.COMTELE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lead_id, phone, name, send_sms, sms_content } = req.body;

  if (!lead_id || !phone) return res.status(400).json({ error: 'Dados incompletos.' });

  try {
    // Limpeza do telefone (Garanta que tenha DDD e 55)
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

    console.log(`🚀 [CALL] Iniciando fluxo para ${name} ID: ${lead_id}`);

    // =================================================================================
    // 1. FAZER A LIGAÇÃO (MANTIDO - DISPARO PRO)
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

    console.log(`📞 Ligação criada (ID: ${callId}). Aguardando 60s...`);

    // =================================================================================
    // 2. ESPERAR 60 SEGUNDOS
    // =================================================================================
    await sleep(60000); 

    // =================================================================================
    // 3. CONSULTAR STATUS DA LIGAÇÃO
    // =================================================================================
    const statusRes = await fetch(`https://gateway.disparopro.com.br/voice/v1/call?id=${callId}`, {
      method: 'GET',
      headers: { 'token': DISPARO_TOKEN }
    });

    const statusJson = await statusRes.json();
    const callItem = statusJson.items ? statusJson.items[0] : (statusJson.data || statusJson);
    
    const finalStatus = callItem?.status_call || callItem?.status || 'UNKNOWN';
    const finalPrice = callItem?.price || 0;

    console.log(`🔎 Status Ligação: ${finalStatus} | Custo: ${finalPrice}`);

    // =================================================================================
    // 4. ENVIAR SMS (ALTERADO - COMTELE)
    // =================================================================================
    if (send_sms && sms_content) {
        try {
            console.log(`📤 Enviando SMS via Comtele para +${cleanPhone}...`);
            
            const smsRes = await fetch('https://sms.comtele.com.br/api/v2/send', {
                method: 'POST',
                headers: {
                    'auth-key': COMTELE_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    Receivers: `+${cleanPhone}`, // Formato E.164 com '+'
                    Content: sms_content
                })
            });

            const smsData = await smsRes.json();

            if (!smsRes.ok || !smsData.Success) {
                console.error('❌ Erro Comtele:', smsData);
            } else {
                console.log(`✅ SMS Enviado com sucesso!`);
            }

        } catch (smsErr) {
            console.error('Erro ao disparar SMS:', smsErr);
        }
    } else {
        console.log(`🔕 SMS Ignorado (Configuração do usuário ou sem conteúdo).`);
    }

    // =================================================================================
    // 5. ATUALIZAR DB (SUPABASE)
    // =================================================================================
    const { data: currentLead } = await supabase
      .from('CALL_LEADS_D2')
      .select('call_count, call_history')
      .eq('id', lead_id)
      .single();

    const currentCount = (currentLead?.call_count || 0) + 1;
    let currentHistory = currentLead?.call_history;

    if (!Array.isArray(currentHistory)) {
        currentHistory = [];
    }

    const newHistoryEntry = {
      call_number: currentCount,
      date: new Date().toISOString(),
      call_id: callId,
      status: finalStatus,
      price: finalPrice,
      sms_sent: !!(send_sms && sms_content) // Flag para registro
    };

    const { error: updateError } = await supabase
      .from('CALL_LEADS_D2')
      .update({
        call_count: currentCount,
        call_history: [...currentHistory, newHistoryEntry], 
        status: 'CALLED',
        called_at: new Date()
      })
      .eq('id', lead_id);

    if (updateError) throw updateError;

    return res.status(200).json({ 
      success: true, 
      count: currentCount, 
      last_status: finalStatus 
    });

  } catch (err: any) {
    console.error('Erro API Call:', err);
    return res.status(500).json({ error: err.message });
  }
}