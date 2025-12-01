// src/pages/api/social/add.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabaseClient';
import fs from 'fs';
import path from 'path';
import os from 'os';
import YTDlpWrap from 'yt-dlp-wrap';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

// Função para baixar o arquivo manualmente, garantindo a versão Standalone
async function downloadBinary(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar binário: ${res.statusText}`);
  const fileStream = fs.createWriteStream(dest);
  // @ts-ignore - ReadableStream do fetch é compatível com pipe no Node moderno
  await finished(Readable.fromWeb(res.body).pipe(fileStream));
}

// Garante que temos o binário CERTO
async function ensureBinaryExists(destination: string) {
  if (fs.existsSync(destination)) {
    // Opcional: verificar tamanho do arquivo para garantir que não está corrompido
    const stats = fs.statSync(destination);
    if (stats.size > 1000000) return; // Se for maior que 1MB, provavelmente está ok
  }

  console.log('⬇️ Baixando yt-dlp standalone manual...');
  
  // URL direta para a versão Linux Standalone (não precisa de Python)
  const DOWNLOAD_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
  
  await downloadBinary(DOWNLOAD_URL, destination);
  
  // Dá permissão de execução
  fs.chmodSync(destination, '755');
  console.log('✅ Download manual concluído.');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { platform, url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL é obrigatória' });

  let tempCookiePath = '';

  try {
    console.log(`📺 [START] Processando ${platform}: ${url}`);

    // Caminho na pasta temporária
    const binaryPath = path.join(os.tmpdir(), 'yt-dlp_linux_standalone');
    
    // Baixa o binário correto
    await ensureBinaryExists(binaryPath);

    // Instancia o wrapper apontando para o nosso binário manual
    const ytDlp = new YTDlpWrap(binaryPath);

    // ============================================================
    // CONFIGURAÇÃO DE COOKIES (IGUAL)
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
    // EXECUÇÃO
    // ============================================================
    let args = [
      url,
      '--dump-json',
      '--skip-download',
      '--no-warnings',
      '--no-check-certificate'
    ];

    if (tempCookiePath) {
        // User Agent genérico para evitar bloqueios
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
        args.push('--cookies', tempCookiePath);
        args.push('--user-agent', userAgent);
    }

    console.log(`Executando: ${binaryPath}`);

    const stdout = await ytDlp.execPromise(args);
    const output = JSON.parse(stdout);

    // ============================================================
    // EXTRAÇÃO DOS DADOS
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

    // Salva no Supabase
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
    // Limpeza
    if (tempCookiePath && fs.existsSync(tempCookiePath)) {
        try { fs.unlinkSync(tempCookiePath); } catch(e) {}
    }
  }
}