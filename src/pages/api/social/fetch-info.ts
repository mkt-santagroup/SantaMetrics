// src/pages/api/social/fetch-info.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import os from 'os';
import YTDlpWrap from 'yt-dlp-wrap';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import { supabase } from '@/lib/supabaseClient';

// --- Reutilize a lógica de download do binário do seu arquivo 'add.ts' ---
// (Estou simplificando aqui, mas você deve garantir que o binário exista igual faz no add.ts)
async function ensureBinaryExists(destination: string) {
  if (fs.existsSync(destination)) return;
  const DOWNLOAD_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
  const res = await fetch(DOWNLOAD_URL);
  if (!res.ok) throw new Error('Falha download binary');
  const fileStream = fs.createWriteStream(destination);
  // @ts-ignore
  await finished(Readable.fromWeb(res.body).pipe(fileStream));
  fs.chmodSync(destination, '755');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Segurança básica: verifique um segredo para ninguém abusar da sua API
  const { secret } = req.query;
  if (secret !== process.env.API_SECRET_KEY) { // Defina isso no seu .env da Railway
     return res.status(401).json({ error: 'Unauthorized' });
  }

  const { url, platform } = req.body;

  if (!url) return res.status(400).json({ error: 'URL missing' });

  let tempCookiePath = '';

  try {
    const binaryPath = path.join(os.tmpdir(), 'yt-dlp_linux_sheet');
    await ensureBinaryExists(binaryPath);
    const ytDlp = new YTDlpWrap(binaryPath);

    // --- Lógica de Cookies (Reutilizada do seu projeto) ---
    if (platform === 'tiktok' || platform === 'instagram') {
        const dbKey = platform === 'tiktok' ? 'tiktok_cookies' : 'instagram_cookies';
        const { data: settings } = await supabase
            .from('SETTINGS') //
            .select('value')
            .eq('key', dbKey)
            .single();

        if (settings?.value) {
            tempCookiePath = path.join(os.tmpdir(), `sheet-cookies-${Date.now()}.txt`);
            fs.writeFileSync(tempCookiePath, settings.value);
        }
    }

    let args = [
      url,
      '--dump-json',
      '--skip-download',
      '--no-warnings',
      '--no-check-certificate'
    ];

    if (tempCookiePath) {
        args.push('--cookies', tempCookiePath);
        args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    }

    const stdout = await ytDlp.execPromise(args);
    const output = JSON.parse(stdout);

    // Extração de dados
    const data = {
        views: output.view_count || output.play_count || 0,
        likes: output.like_count || 0,
        comments: output.comment_count || 0,
        shares: output.repost_count || output.share_count || 0,
        author: output.uploader || output.channel || 'Desconhecido',
        title: output.title || ''
    };

    // Retorna JSON para o Google Sheets
    return res.status(200).json(data);

  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  } finally {
    if (tempCookiePath && fs.existsSync(tempCookiePath)) fs.unlinkSync(tempCookiePath);
  }
}