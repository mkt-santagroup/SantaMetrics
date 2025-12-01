// src/pages/api/social/add.ts
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

    // 1. PREPARAR COOKIES (Se necessário)
    if (platform === 'tiktok' || platform === 'instagram') {
        const dbKey = platform === 'tiktok' ? 'tiktok_cookies' : 'instagram_cookies';
        const { data: settings } = await supabase.from('SETTINGS').select('value').eq('key', dbKey).single();

        if (!settings?.value) {
            return res.status(400).json({ error: `Cookies do ${platform} não configurados.` });
        }

        tempCookiePath = path.join(os.tmpdir(), `${platform}-cookies-${Date.now()}.txt`);
        fs.writeFileSync(tempCookiePath, settings.value);
    }

    // 2. MONTAR O COMANDO (AQUI ESTÁ A CORREÇÃO RAILWAY)
    // Usamos 'python3 -m yt_dlp' que é infalível se o python estiver instalado
    // No Windows local, ele pode precisar ser apenas 'yt-dlp' ou 'python -m yt_dlp'
    
    // Detecta se é Windows ou Linux (Railway)
    const isWindows = process.platform === 'win32';
    const baseCommand = isWindows ? 'yt-dlp' : 'python3 -m yt_dlp';

    const userAgent = '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"';
    
    let args = `--dump-json --skip-download --no-warnings --user-agent ${userAgent}`;
    
    if (tempCookiePath) {
        args += ` --cookies "${tempCookiePath}"`;
    }

    const fullCommand = `${baseCommand} ${args} "${url}"`;

    console.log(`Executando comando: ${fullCommand}`);
    
    // 3. EXECUÇÃO (Com Timeout de 25s)
    const { stdout } = await execPromise(fullCommand, { timeout: 25000 });
    
    if (!stdout) throw new Error("Sem resposta do yt-dlp");

    const output = JSON.parse(stdout);

    // 4. EXTRAÇÃO
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

    console.log("✅ Dados Extraídos:", extractedData);

    // 5. SALVAR NO BANCO
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
    
    // Mostra erro detalhado se for stderr
    const errorDetails = err.stderr || err.message;
    
    return res.status(500).json({ 
        error: 'Erro ao processar URL.', 
        details: errorDetails 
    });
  } finally {
    if (tempCookiePath && fs.existsSync(tempCookiePath)) {
        try { fs.unlinkSync(tempCookiePath); } catch(e) {}
    }
  }
}