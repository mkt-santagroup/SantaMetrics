// src/pages/api/social/sheet.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabaseClient';
import fs from 'fs';
import path from 'path';
import os from 'os';
import YTDlpWrap from 'yt-dlp-wrap';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import { ApifyClient } from 'apify-client';

// --- Funções Auxiliares (Binário) ---
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
  // Sempre tenta pegar a versão mais recente do yt-dlp
  const DOWNLOAD_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
  await downloadBinary(DOWNLOAD_URL, destination);
  fs.chmodSync(destination, '755');
}

// --- NOVA FUNÇÃO: Tenta baixar TikTok com várias estratégias ---
async function fetchTikTokWithRetry(url: string, ytDlp: YTDlpWrap, cookiePath: string): Promise<any> {
  const userAgents = [
    // 1. PC Moderno (Chrome 120)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // 2. iPhone (Mobile Safari) - Fallback
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
  ];

  // Tentativa 1: Cookie + PC
  try {
    return await runYtDlp(url, ytDlp, cookiePath, userAgents[0]);
  } catch (e) {
    console.warn(`[TikTok Retry 1] Falha PC com Cookie. Tentando Mobile... (${url})`);
  }

  // Tentativa 2: Cookie + Mobile
  try {
    return await runYtDlp(url, ytDlp, cookiePath, userAgents[1]);
  } catch (e) {
    console.warn(`[TikTok Retry 2] Falha Mobile com Cookie. Tentando sem Cookie... (${url})`);
  }

  // Tentativa 3: SEM Cookie + PC (Última chance)
  try {
    return await runYtDlp(url, ytDlp, null, userAgents[0]);
  } catch (e) {
    console.error(`[TikTok Fail] Desistindo de ${url}`);
    throw e; // Se falhar as 3, desiste
  }
}

// Executa o comando real
async function runYtDlp(url: string, ytDlp: YTDlpWrap, cookiePath: string | null, userAgent: string) {
  let args = [
    url,
    '--dump-json',
    '--skip-download',
    '--no-warnings',
    '--no-check-certificate',
    '--user-agent', userAgent
  ];

  if (cookiePath) {
    args.push('--cookies', cookiePath);
  }

  const stdout = await ytDlp.execPromise(args);
  return JSON.parse(stdout);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { secret } = req.query;
  if (secret !== process.env.API_SECRET_KEY) { 
     return res.status(401).json({ error: 'Senha incorreta' });
  }

  // MODO GET (POLLING)
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
                const matchUrl = item.url || item.inputUrl; 
                const views = item.videoPlayCount || item.playCount || item.videoViewCount || item.viewCount || 0;
                
                results[matchUrl] = {
                    name_account: item.ownerUsername || 'Desconhecido',
                    date: item.timestamp ? new Date(item.timestamp).toLocaleDateString('pt-BR') : '-',
                    views: views, 
                    likes: item.likesCount || item.likeCount || 0, 
                    comments: item.commentsCount || item.commentCount || 0,
                    saves: 0,
                    shares: 0
                };
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

  // MODO POST (START)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const items = req.body.items || [];
  if (!items || items.length === 0) return res.status(400).json({ error: 'Lista vazia' });

  const instaItems = items.filter((i: any) => i.platform === 'instagram');
  const otherItems = items.filter((i: any) => i.platform !== 'instagram');
  const results: Record<string, any> = {};

  // 1. INSTAGRAM (Via Apify - Assíncrono)
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
        return res.status(500).json({ error: 'Falha Apify' });
    }
  }

  // 2. TIKTOK/YOUTUBE (Via YT-DLP - Síncrono com Retry)
  if (otherItems.length > 0) {
     try {
        const binaryPath = path.join(os.tmpdir(), 'yt-dlp_linux_sheet_batch');
        await ensureBinaryExists(binaryPath);
        
        const ytDlp = new YTDlpWrap(binaryPath);
        let tempCookiePath = '';
        
        // Prepara Cookie do TikTok
        if (otherItems.some((i: any) => i.platform === 'tiktok')) {
            const { data: s } = await supabase.from('SETTINGS').select('value').eq('key', 'tiktok_cookies').single();
            if (s?.value) {
                tempCookiePath = path.join(os.tmpdir(), `batch-${Date.now()}.txt`);
                fs.writeFileSync(tempCookiePath, s.value);
            }
        }

        // Processa em paralelo
        await Promise.all(otherItems.map(async (item: any) => {
            try {
                let output;
                
                if (item.platform === 'tiktok') {
                    // USA A NOVA LÓGICA DE 3 VIDAS
                    output = await fetchTikTokWithRetry(item.url, ytDlp, tempCookiePath);
                } else {
                    // Youtube (Padrão)
                    output = await runYtDlp(item.url, ytDlp, null, 'Mozilla/5.0');
                }

                results[item.url] = {
                    name_account: output.uploader || output.channel || 'Desconhecido',
                    date: output.upload_date 
                        ? `${output.upload_date.substring(6,8)}/${output.upload_date.substring(4,6)}/${output.upload_date.substring(0,4)}` 
                        : new Date().toLocaleDateString('pt-BR'),
                    views: output.view_count || output.play_count || 0,
                    likes: output.like_count || 0,
                    comments: output.comment_count || 0,
                    saves: output.save_count || 0,
                    shares: output.repost_count || output.share_count || 0
                };
            } catch (e) {
                // Se falhou todas as tentativas
                results[item.url] = { error: 'Bloqueio/Erro Link' };
            }
        }));

        if (tempCookiePath && fs.existsSync(tempCookiePath)) fs.unlinkSync(tempCookiePath);
     } catch (e) {
         console.error("Erro YT-DLP:", e);
     }
  }

  return res.status(200).json({ 
      runId: apifyRunId, 
      results: results,
      status: apifyRunId ? 'QUEUED' : 'DONE'
  });
}