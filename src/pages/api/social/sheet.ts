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
  const DOWNLOAD_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
  await downloadBinary(DOWNLOAD_URL, destination);
  fs.chmodSync(destination, '755');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { secret } = req.query;
  if (secret !== process.env.API_SECRET_KEY) { 
     return res.status(401).json({ error: 'Senha incorreta' });
  }

  // =================================================================================
  // MODO 1: VERIFICAR STATUS (POLLING) - GET
  // =================================================================================
  if (req.method === 'GET' && req.query.runId) {
    const runId = req.query.runId as string;
    
    if (!process.env.APIFY_TOKEN) return res.status(500).json({ error: 'No Token' });
    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

    try {
        const run = client.run(runId);
        const { status } = await run.get() || {};

        if (status === 'SUCCEEDED') {
            // Se acabou, pega os dados e formata
            const { items: apifyResults } = await client.dataset((await run.get())!.defaultDatasetId).listItems();
            const results: Record<string, any> = {};

            apifyResults.forEach((item: any) => {
                const matchUrl = item.url || item.inputUrl; 
                // Prioridade de Views para Reels
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
            // Ainda rodando
            return res.status(200).json({ status: 'PENDING' });
        } else {
            // Falhou ou Abortou
            return res.status(200).json({ status: 'FAILED', error: 'Apify falhou ou parou.' });
        }
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
  }

  // =================================================================================
  // MODO 2: INICIAR PROCESSO - POST
  // =================================================================================
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const items = req.body.items || [];
  if (!items || items.length === 0) return res.status(400).json({ error: 'Lista vazia' });

  const instaItems = items.filter((i: any) => i.platform === 'instagram');
  const otherItems = items.filter((i: any) => i.platform !== 'instagram');
  const results: Record<string, any> = {};

  // --- ESTRATÉGIA INSTAGRAM (ASSÍNCRONA) ---
  let apifyRunId = null;
  if (instaItems.length > 0) {
    try {
        if (!process.env.APIFY_TOKEN) throw new Error("APIFY_TOKEN não configurado");
        const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
        
        // .start() inicia e devolve o ID imediatamente (NÃO ESPERA ACABAR)
        const run = await client.actor("apify/instagram-scraper").start({
            directUrls: instaItems.map((i: any) => i.url),
            resultsType: "posts",
            searchLimit: 1,
        });
        
        apifyRunId = run.id; // Guarda o ID para o front monitorar
    } catch (e: any) {
        console.error(e);
        return res.status(500).json({ error: 'Falha ao iniciar Apify' });
    }
  }

  // --- ESTRATÉGIA OUTROS (SÍNCRONA - RÁPIDA) ---
  if (otherItems.length > 0) {
     // ... (Mantém a lógica do yt-dlp do código anterior aqui para brevidade) ...
     // Vou resumir para focar na solução, mas o ideal é manter seu código yt-dlp aqui
     // Se quiser, posso repostar o bloco yt-dlp, mas ele não mudou.
     // Assumindo que você manteve o bloco yt-dlp aqui e populou 'results'.
     try {
        const binaryPath = path.join(os.tmpdir(), 'yt-dlp_linux_sheet_batch');
        await ensureBinaryExists(binaryPath);
        let tempCookiePath = '';
        if (otherItems.some((i: any) => i.platform === 'tiktok')) {
            const { data: s } = await supabase.from('SETTINGS').select('value').eq('key', 'tiktok_cookies').single();
            if (s?.value) {
                tempCookiePath = path.join(os.tmpdir(), `batch-${Date.now()}.txt`);
                fs.writeFileSync(tempCookiePath, s.value);
            }
        }
        await Promise.all(otherItems.map(async (item: any) => {
            try {
                const ytDlp = new YTDlpWrap(binaryPath);
                let args = [ item.url, '--dump-json', '--skip-download', '--no-warnings', '--no-check-certificate' ];
                if (tempCookiePath && item.platform === 'tiktok') {
                    args.push('--cookies', tempCookiePath);
                    args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
                }
                const stdout = await ytDlp.execPromise(args);
                const output = JSON.parse(stdout);
                results[item.url] = {
                    name_account: output.uploader || 'Desconhecido',
                    date: new Date().toLocaleDateString('pt-BR'),
                    views: output.view_count || output.play_count || 0,
                    likes: output.like_count || 0,
                    comments: output.comment_count || 0,
                    saves: 0, shares: output.repost_count || 0
                };
            } catch (e) { results[item.url] = { error: 'Erro Link' }; }
        }));
        if (tempCookiePath && fs.existsSync(tempCookiePath)) fs.unlinkSync(tempCookiePath);
     } catch (e) {}
  }

  // RETORNO INTELIGENTE
  // Se tem runId do Apify, manda ele para o Sheets monitorar.
  // Se tem resultados do yt-dlp, manda junto.
  return res.status(200).json({ 
      runId: apifyRunId, 
      results: results,
      status: apifyRunId ? 'QUEUED' : 'DONE'
  });
}