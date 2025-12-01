// src/pages/api/social/sheet.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import os from 'os';
import YTDlpWrap from 'yt-dlp-wrap';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import { supabase } from '@/lib/supabaseClient'; // Para pegar os cookies se precisar

// Função auxiliar para garantir que o binário existe (reutilizando lógica)
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
  // 1. Segurança simples (Chave secreta)
  const { secret } = req.query;
  // Defina API_SECRET_KEY no seu .env da Railway (ex: santa123)
  if (secret !== process.env.API_SECRET_KEY) { 
     return res.status(401).json({ error: 'Senha incorreta' });
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { url, platform } = req.body;
  if (!url) return res.status(400).json({ error: 'Faltou a URL' });

  let tempCookiePath = '';

  try {
    // 2. Preparar yt-dlp
    const binaryPath = path.join(os.tmpdir(), 'yt-dlp_linux_sheet');
    await ensureBinaryExists(binaryPath);
    const ytDlp = new YTDlpWrap(binaryPath);

    // 3. Pegar Cookies do Banco (Se for Insta ou TikTok)
    if (platform === 'tiktok' || platform === 'instagram') {
        const dbKey = platform === 'tiktok' ? 'tiktok_cookies' : 'instagram_cookies';
        const { data: settings } = await supabase
            .from('SETTINGS')
            .select('value')
            .eq('key', dbKey)
            .single();

        if (settings?.value) {
            tempCookiePath = path.join(os.tmpdir(), `sheet-${Date.now()}.txt`);
            fs.writeFileSync(tempCookiePath, settings.value);
        }
    }

    // 4. Configurar argumentos do comando
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

    // 5. Executar
    const stdout = await ytDlp.execPromise(args);
    const output = JSON.parse(stdout);

    // 6. Formatar dados exatos para a planilha
    // Colunas da sua imagem: Link (já tem), Name Account, Data, Views, Likes, Comentários, Salvos, Shares
    const data = {
        name_account: output.uploader || output.channel || output.uploader_id || 'Desconhecido',
        date: output.upload_date 
              ? `${output.upload_date.substring(6,8)}/${output.upload_date.substring(4,6)}/${output.upload_date.substring(0,4)}` 
              : new Date().toLocaleDateString('pt-BR'),
        views: output.view_count || output.play_count || 0,
        likes: output.like_count || 0,
        comments: output.comment_count || 0,
        saves: output.save_count || 0, // yt-dlp as vezes pega saves, as vezes não
        shares: output.repost_count || output.share_count || 0
    };

    return res.status(200).json(data);

  } catch (error: any) {
    console.error("Erro na API da Planilha:", error);
    return res.status(500).json({ error: error.message || 'Erro ao processar' });
  } finally {
    if (tempCookiePath && fs.existsSync(tempCookiePath)) fs.unlinkSync(tempCookiePath);
  }
}