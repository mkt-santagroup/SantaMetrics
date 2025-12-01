// src/pages/api/social/add.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabaseClient';
import fs from 'fs';
import path from 'path';
import os from 'os';
import YTDlpWrap from 'yt-dlp-wrap';

// Função auxiliar para garantir que o binário existe
async function ensureBinaryExists(destination: string) {
  if (fs.existsSync(destination)) {
    return; // Já existe, segue o jogo
  }

  console.log('⬇️ Binário não encontrado. Baixando yt-dlp para Linux...');
  
  // Instancia temporária apenas para usar o downloader
  const downloader = new YTDlpWrap();
  
  // Baixa a versão LINUX (que é standalone e não depende do python do sistema)
  // O 'undefined' no segundo argumento pega a versão mais recente
  // O 'linux' força o binário correto pro Railway
  await downloader.downloadFromGithub(destination, undefined, 'linux');
  
  // Garante permissão de execução (chmod +x)
  fs.chmodSync(destination, '755');
  console.log('✅ Download concluído e permissão concedida.');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { platform, url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL é obrigatória' });

  let tempCookiePath = '';

  try {
    console.log(`📺 [START] Processando ${platform}: ${url}`);

    // ============================================================
    // 1. PREPARAÇÃO DO BINÁRIO (A Solução Nuclear)
    // ============================================================
    // Vamos usar a pasta /tmp que é garantida de ter permissão de escrita no Railway
    const binaryPath = path.join(os.tmpdir(), 'yt-dlp_linux');
    
    // Verifica e baixa se necessário
    await ensureBinaryExists(binaryPath);

    // Instancia apontando EXPLICITAMENTE para o arquivo em /tmp
    const ytDlp = new YTDlpWrap(binaryPath);

    // ============================================================
    // 2. COOKIES
    // ============================================================
    if (platform === 'tiktok' || platform === 'instagram') {
        const dbKey = platform === 'tiktok' ? 'tiktok_cookies' : 'instagram_cookies';
        
        const { data: settings } = await supabase
            .from('SETTINGS')
            .select('value')
            .eq('key', dbKey)
            .single();

        if (settings?.value) {
            tempCookiePath = path.join(os.tmpdir(), `${platform}-cookies-${Date.now()}.txt`);
            fs.writeFileSync(tempCookiePath, settings.value);
        }
    }

    // ============================================================
    // 3. EXECUÇÃO
    // ============================================================
    let args = [
      url,
      '--dump-json',
      '--skip-download',
      '--no-warnings',
      '--no-check-certificate'
    ];

    if (tempCookiePath) {
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
        args.push('--cookies', tempCookiePath);
        args.push('--user-agent', userAgent);
    }

    console.log(`Executando binário em: ${binaryPath}`);

    const stdout = await ytDlp.execPromise(args);
    const output = JSON.parse(stdout);

    // ============================================================
    // 4. EXTRAÇÃO
    // ============================================================
    const views = output.view_count || output.play_count || 0;
    const shares = output.repost_count || output.share_count || 0;
    const author = output.uploader || output.channel || output.uploader_id || output.creator || 'Desconhecido';

    const extractedData = {
        views: views,
        likes: output.like_count || 0,
        coments: output.comment_count || 0,
        saves: output.save_count || 0,
        shares: shares,
        name_account: author,
        thumbnail: output.thumbnail || '',
    };

    console.log("✅ Sucesso:", extractedData);

    // ============================================================
    // 5. SALVAR NO BANCO
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
    console.error("❌ Erro Crítico:", err);
    return res.status(500).json({ 
        error: 'Erro ao processar URL.', 
        details: err.message || JSON.stringify(err)
    });
  } finally {
    if (tempCookiePath && fs.existsSync(tempCookiePath)) {
        try { fs.unlinkSync(tempCookiePath); } catch(e) {}
    }
  }
}