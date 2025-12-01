// src/pages/api/social/sheet.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabaseClient';
import fs from 'fs';
import path from 'path';
import os from 'os';
import YTDlpWrap from 'yt-dlp-wrap';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import { ApifyClient } from 'apify-client'; // <--- Nova Importação

// --- Funções Auxiliares do YT-DLP (Mantidas para TikTok/Youtube) ---
async function downloadBinary(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar binário: ${res.statusText}`);
  const fileStream = fs.createWriteStream(dest);
  // @ts-ignore
  await finished(Readable.fromWeb(res.body).pipe(fileStream));
}

async function ensureBinaryExists(destination: string) {
  if (fs.existsSync(destination)) {
    const stats = fs.statSync(destination);
    if (stats.size > 1000000) return; 
  }
  const DOWNLOAD_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
  await downloadBinary(DOWNLOAD_URL, destination);
  fs.chmodSync(destination, '755');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Segurança
  const { secret } = req.query;
  if (secret !== process.env.API_SECRET_KEY) { 
     return res.status(401).json({ error: 'Senha incorreta' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, platform } = req.body;
  if (!url) return res.status(400).json({ error: 'URL faltando' });

  // =================================================================================
  // LÓGICA NOVA: INSTAGRAM VIA APIFY
  // =================================================================================
  if (platform === 'instagram') {
    if (!process.env.APIFY_TOKEN) {
        return res.status(500).json({ error: 'APIFY_TOKEN não configurado no servidor' });
    }

    try {
        const client = new ApifyClient({
            token: process.env.APIFY_TOKEN,
        });

        // Chama o Actor "apify/instagram-scraper" (O mesmo da sua imagem)
        const run = await client.actor("apify/instagram-scraper").call({
            directUrls: [url],
            resultsType: "posts", // Queremos detalhes do post
            searchLimit: 1,
        });

        // Pega os resultados do dataset
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        if (!items || items.length === 0) {
            return res.status(404).json({ error: 'Instagram não retornou dados. Perfil privado?' });
        }

        const item: any = items[0];

        // Formata a data (O Apify retorna ISO string ex: 2023-12-25T10:00:00.000Z)
        const dateObj = new Date(item.timestamp);
        const dateFormatted = dateObj.toLocaleDateString('pt-BR');

        const data = {
            name_account: item.ownerUsername || 'Desconhecido',
            date: dateFormatted,
            views: item.videoViewCount || item.videoPlayCount || 0, // Views se for vídeo/reels
            likes: item.likesCount || 0,
            comments: item.commentsCount || 0,
            saves: 0, // A API pública geralmente não entrega Saves/Shares
            shares: 0 
        };

        return res.status(200).json(data);

    } catch (error: any) {
        console.error("Erro Apify:", error);
        return res.status(500).json({ error: 'Erro ao consultar Apify: ' + error.message });
    }
  }

  // =================================================================================
  // LÓGICA ANTIGA: TIKTOK E YOUTUBE (VIA YT-DLP)
  // =================================================================================
  let tempCookiePath = '';

  try {
    const binaryPath = path.join(os.tmpdir(), 'yt-dlp_linux_standalone');
    await ensureBinaryExists(binaryPath);
    const ytDlp = new YTDlpWrap(binaryPath);

    if (platform === 'tiktok') {
        const { data: settings } = await supabase
            .from('SETTINGS')
            .select('value')
            .eq('key', 'tiktok_cookies')
            .single();

        if (settings?.value) {
            tempCookiePath = path.join(os.tmpdir(), `sheet-${Date.now()}.txt`);
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

    const data = {
        name_account: output.uploader || output.channel || output.uploader_id || 'Desconhecido',
        date: output.upload_date 
              ? `${output.upload_date.substring(6,8)}/${output.upload_date.substring(4,6)}/${output.upload_date.substring(0,4)}` 
              : new Date().toLocaleDateString('pt-BR'),
        views: output.view_count || output.play_count || 0,
        likes: output.like_count || 0,
        comments: output.comment_count || 0,
        saves: output.save_count || 0,
        shares: output.repost_count || output.share_count || 0
    };

    return res.status(200).json(data);

  } catch (error: any) {
    console.error("Erro YT-DLP:", error);
    return res.status(500).json({ error: error.message || 'Erro ao processar' });
  } finally {
    if (tempCookiePath && fs.existsSync(tempCookiePath)) fs.unlinkSync(tempCookiePath);
  }
}