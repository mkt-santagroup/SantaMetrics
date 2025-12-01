import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabaseClient';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execPromise = util.promisify(exec);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { platform, url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL é obrigatória' });

  let tempCookiePath = '';

  try {
    let extractedData: any = {};
    console.log(`📺 [START] Processando ${platform}: ${url}`);

    // ============================================================
    // PREPARAÇÃO DE COOKIES (TIKTOK E INSTAGRAM)
    // ============================================================
    if (platform === 'tiktok' || platform === 'instagram') {
        const dbKey = platform === 'tiktok' ? 'tiktok_cookies' : 'instagram_cookies';
        
        const { data: settings } = await supabase
            .from('SETTINGS')
            .select('value')
            .eq('key', dbKey)
            .single();

        if (!settings?.value) {
            return res.status(400).json({ error: `Cookies do ${platform} não configurados.` });
        }

        // Cria arquivo temporário
        tempCookiePath = path.join(os.tmpdir(), `${platform}-cookies-${Date.now()}.txt`);
        fs.writeFileSync(tempCookiePath, settings.value);
    }

    // ============================================================
    // EXECUÇÃO DO YT-DLP (COM TIMEOUT DE 20 SEGUNDOS)
    // ============================================================
    
    // Monta o comando base
    let command = `yt-dlp --dump-json --skip-download --no-warnings "${url}"`;

    // Se tiver cookie, adiciona no comando
    if (tempCookiePath) {
        const userAgent = '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"';
        command = `yt-dlp --dump-json --skip-download --no-warnings --cookies "${tempCookiePath}" --user-agent ${userAgent} "${url}"`;
    }

    console.log(`Executando yt-dlp para ${platform}...`);
    
    // AQUI ESTÁ A CORREÇÃO: TIMEOUT DE 20s
    // Se passar de 20s, ele lança um erro e não trava o app
    const { stdout } = await execPromise(command, { timeout: 20000 });
    
    if (!stdout) throw new Error("Sem resposta do yt-dlp");

    const output = JSON.parse(stdout);

    // ============================================================
    // EXTRAÇÃO DE DADOS
    // ============================================================
    
    const views = output.view_count || output.play_count || 0;
    const shares = output.repost_count || output.share_count || 0;
    const author = output.uploader || output.channel || output.uploader_id || 'Desconhecido';

    extractedData = {
        views: views,
        likes: output.like_count || 0,
        coments: output.comment_count || 0,
        saves: output.save_count || 0,
        shares: shares,
        name_account: author,
        thumbnail: output.thumbnail || '',
    };

    console.log("✅ Dados Extraídos com Sucesso");

    // ============================================================
    // SALVAR NO BANCO
    // ============================================================
    const tableName = 
      platform === 'youtube' ? 'VIEWS-YOUTUBE' : 
      platform === 'tiktok' ? 'VIEWS-TIKTOK' : 'VIEWS-INSTAGRAM';

    const { error } = await supabase
      .from(tableName)
      .upsert({
        url: url, 
        ...extractedData,
        created_at: new Date().toISOString() 
      });

    if (error) throw error;

    return res.status(200).json({ success: true, data: extractedData });

  } catch (err: any) {
    console.error("❌ Erro ao processar:", url);
    console.error(err.message || err);
    
    // Retorna erro 500 mas com JSON válido para o frontend não travar esperando
    return res.status(500).json({ 
        error: 'Erro ao processar URL. Tempo excedido ou link inválido.', 
        details: err.message 
    });
  } finally {
    // Limpeza do arquivo de cookie
    if (tempCookiePath && fs.existsSync(tempCookiePath)) {
        try { fs.unlinkSync(tempCookiePath); } catch(e) {}
    }
  }
}