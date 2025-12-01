// src/pages/api/social/sheet.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import os from 'os';
import YTDlpWrap from 'yt-dlp-wrap';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import { ApifyClient } from 'apify-client';

// --- 1. FUNÇÕES AUXILIARES (Apenas para YouTube agora) ---
async function downloadBinary(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha download binário: ${res.statusText}`);
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

// --- 2. NOVA FUNÇÃO: TIKTOK VIA API EXTERNA (TIKWM) ---
// Rápida, sem bloqueio e sem cookies.
async function fetchTikTokData(url: string) {
  try {
    // API pública do TikWM (usada por muitos scrapers para evitar bloqueio)
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    
    // Timeout curto para não travar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    const json = await response.json();

    if (json.code === 0 && json.data) {
      const item = json.data;
      return {
        name_account: item.author?.unique_id || 'Desconhecido',
        date: new Date(item.create_time * 1000).toLocaleDateString('pt-BR'),
        views: item.play_count || 0,
        likes: item.digg_count || 0,
        comments: item.comment_count || 0,
        shares: item.share_count || 0,
        saves: item.download_count || 0, 
      };
    } else {
      return { error: 'API TikTok falhou ou vídeo privado' };
    }
  } catch (error) {
    console.error('Erro TikTok API:', error);
    return { error: 'Erro de conexão TikTok' };
  }
}

// --- 3. FUNÇÃO YOUTUBE (YT-DLP) ---
async function fetchYoutubeData(url: string, ytDlp: YTDlpWrap) {
  try {
    const args = [
      url,
      '--dump-json',
      '--skip-download',
      '--no-warnings',
      '--no-check-certificate',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];
    const stdout = await ytDlp.execPromise(args);
    const output = JSON.parse(stdout);

    return {
        name_account: output.uploader || output.channel || 'Desconhecido',
        date: output.upload_date 
            ? `${output.upload_date.substring(6,8)}/${output.upload_date.substring(4,6)}/${output.upload_date.substring(0,4)}` 
            : new Date().toLocaleDateString('pt-BR'),
        views: output.view_count || 0,
        likes: output.like_count || 0,
        comments: output.comment_count || 0,
        saves: 0, 
        shares: 0 
    };
  } catch (e) {
    console.error('Erro Youtube:', e);
    return { error: 'Erro Link Youtube' };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { secret } = req.query;
  // Verifica a senha do .env da Railway
  if (secret !== process.env.API_SECRET_KEY) { 
     return res.status(401).json({ error: 'Senha incorreta' });
  }

  // MODO GET (POLLING PARA INSTAGRAM)
  if (req.method === 'GET' && req.query.runId) {
    const runId = req.query.runId as string;
    
    if (!process.env.APIFY_TOKEN) return res.status(500).json({ error: 'No Token' });
    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

    try {
        const runClient = client.run(runId);
        const runInfo = await runClient.get();
        const status = runInfo?.status;

        if (status === 'SUCCEEDED') {
            const { items: apifyResults } = await client.dataset(runInfo!.defaultDatasetId).listItems();
            const results: Record<string, any> = {};

            apifyResults.forEach((item: any) => {
                // Tenta pegar a URL de várias formas que o Apify retorna
                const matchUrl = item.url || item.inputUrl || (item.input && item.input.url); 
                
                const views = item.videoPlayCount || item.playCount || item.videoViewCount || item.viewCount || 0;
                
                if (matchUrl) {
                    results[matchUrl] = {
                        name_account: item.ownerUsername || 'Desconhecido',
                        date: item.timestamp ? new Date(item.timestamp).toLocaleDateString('pt-BR') : '-',
                        views: views, 
                        likes: item.likesCount || item.likeCount || 0, 
                        comments: item.commentsCount || item.commentCount || 0,
                        saves: 0,
                        shares: 0
                    };
                }
            });
            
            return res.status(200).json({ status: 'DONE', results });
        } else if (status === 'RUNNING' || status === 'READY') {
            return res.status(200).json({ status: 'PENDING' });
        } else {
            return res.status(200).json({ status: 'FAILED', error: 'Apify falhou.' });
        }
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
  }

  // MODO POST (INÍCIO)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const items = req.body.items || [];
  if (!items || items.length === 0) return res.status(400).json({ error: 'Lista vazia' });

  const instaItems = items.filter((i: any) => i.platform === 'instagram');
  const otherItems = items.filter((i: any) => i.platform !== 'instagram');
  const results: Record<string, any> = {};

  // 1. INSTAGRAM (Start Apify)
  let apifyRunId = null;
  if (instaItems.length > 0) {
    try {
        if (!process.env.APIFY_TOKEN) throw new Error("APIFY_TOKEN não configurado");
        const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
        
        const run = await client.actor("apify/instagram-scraper").start({
            directUrls: instaItems.map((i: any) => i.url),
            resultsType: "posts",
            searchLimit: 1,
        });
        apifyRunId = run.id;
    } catch (e: any) {
        console.error(e);
        instaItems.forEach((i: any) => results[i.url] = { error: 'Falha Start Apify' });
    }
  }

  // 2. TIKTOK & YOUTUBE (Processamento Imediato)
  if (otherItems.length > 0) {
     // Configura yt-dlp APENAS se tiver youtube
     let ytDlp: YTDlpWrap | null = null;
     if (otherItems.some((i: any) => i.platform === 'youtube')) {
        try {
            const binaryPath = path.join(os.tmpdir(), 'yt-dlp_linux_final');
            await ensureBinaryExists(binaryPath);
            ytDlp = new YTDlpWrap(binaryPath);
        } catch(e) { console.error("Erro setup yt-dlp", e); }
     }

     await Promise.all(otherItems.map(async (item: any) => {
        // --- AQUI ESTÁ A MUDANÇA: TIKTOK USA API EXTERNA ---
        if (item.platform === 'tiktok') {
            results[item.url] = await fetchTikTokData(item.url);
        } 
        // --- YOUTUBE CONTINUA COM YT-DLP ---
        else if (item.platform === 'youtube' && ytDlp) {
            results[item.url] = await fetchYoutubeData(item.url, ytDlp);
        } 
        else {
            results[item.url] = { error: 'Plataforma/Ferramenta indisponível' };
        }
     }));
  }

  return res.status(200).json({ 
      runId: apifyRunId, 
      results: results,
      status: apifyRunId ? 'QUEUED' : 'DONE'
  });
}