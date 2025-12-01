// src/pages/api/social/add.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabaseClient';
import fs from 'fs';
import path from 'path';
import os from 'os';
import YTDlpWrap from 'yt-dlp-wrap';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { platform, url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL é obrigatória' });

  let tempCookiePath = '';

  try {
    console.log(`📺 [START] Processando ${platform}: ${url}`);

    // --- 1. PREPARAÇÃO DO YT-DLP ---
    // Inicializa o wrapper. Ele vai procurar o binário ou usar o do sistema.
    const ytDlpWrap = new YTDlpWrap();
    
    // Opcional: Garantir que o binário existe (em produção pode ser necessário baixar)
    // Mas geralmente o 'yt-dlp-wrap' tenta usar o do sistema se não achar local.
    // No Railway com nixpacks, ele deve achar o do sistema se o comando for 'yt-dlp'.

    // --- 2. COOKIES ---
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

        tempCookiePath = path.join(os.tmpdir(), `${platform}-cookies-${Date.now()}.txt`);
        fs.writeFileSync(tempCookiePath, settings.value);
    }

    // --- 3. EXECUÇÃO ---
    // Monta os argumentos como um Array (mais seguro que string)
    let args = [
      url,
      '--dump-json',
      '--skip-download',
      '--no-warnings'
    ];

    if (tempCookiePath) {
        const userAgent = '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"';
        args.push('--cookies', tempCookiePath);
        args.push('--user-agent', userAgent);
    }

    console.log(`Executando yt-dlp...`);

    // Executa usando a biblioteca (Promise)
    const stdout = await ytDlpWrap.execPromise(args);
    const output = JSON.parse(stdout);

    // --- 4. EXTRAÇÃO ---
    const views = output.view_count || output.play_count || 0;
    const shares = output.repost_count || output.share_count || 0;
    const author = output.uploader || output.channel || output.uploader_id || 'Desconhecido';

    const extractedData = {
        views: views,
        likes: output.like_count || 0,
        coments: output.comment_count || 0,
        saves: output.save_count || 0,
        shares: shares,
        name_account: author,
        thumbnail: output.thumbnail || '',
    };

    console.log("✅ Dados Extraídos:", extractedData);

    // --- 5. SALVAR ---
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
    console.error("❌ Erro Geral:", err);
    return res.status(500).json({ error: 'Erro ao processar URL', details: err.message });
  } finally {
    if (tempCookiePath && fs.existsSync(tempCookiePath)) {
        try { fs.unlinkSync(tempCookiePath); } catch(e) {}
    }
  }
}