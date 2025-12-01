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

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ACEITA LISTA DE ITENS AGORA
  // body: { items: [ { url: '...', platform: '...' }, ... ] }
  const items = req.body.items || [];
  if (!items || items.length === 0) {
      // Suporte legado para chamada unitária, caso precise
      if (req.body.url) items.push({ url: req.body.url, platform: req.body.platform });
      else return res.status(400).json({ error: 'Lista vazia' });
  }

  const results: Record<string, any> = {};

  // Separa por estratégia
  const instaItems = items.filter((i: any) => i.platform === 'instagram');
  const otherItems = items.filter((i: any) => i.platform !== 'instagram');

  // =================================================================================
  // 1. INSTAGRAM (LOTE VIA APIFY) - MÁXIMA VELOCIDADE
  // =================================================================================
  if (instaItems.length > 0) {
    try {
        if (!process.env.APIFY_TOKEN) throw new Error("APIFY_TOKEN não configurado");
        
        const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
        const urlsToScrape = instaItems.map((i: any) => i.url);

        // Chama o Apify uma única vez com TODAS as URLs
        const run = await client.actor("apify/instagram-scraper").call({
            directUrls: urlsToScrape,
            resultsType: "posts",
            searchLimit: 1,
        });

        const { items: apifyResults } = await client.dataset(run.defaultDatasetId).listItems();

        // Mapeia os resultados de volta para a URL correta
        apifyResults.forEach((item: any) => {
            // Tenta encontrar a URL original correspondente
            // O Apify retorna 'url' ou 'inputUrl', dependendo da versão
            const matchUrl = item.url || item.inputUrl; 
            
            // CORREÇÃO VIEWS: Prioridade para videoPlayCount (Reels)
            const views = item.videoPlayCount || item.playCount || item.videoViewCount || item.viewCount || 0;
            const likes = item.likesCount || item.likeCount || 0;
            const comments = item.commentsCount || item.commentCount || 0;
            
            // Formata data
            let dateFormatted = '-';
            if (item.timestamp) {
                dateFormatted = new Date(item.timestamp).toLocaleDateString('pt-BR');
            }

            results[matchUrl] = {
                name_account: item.ownerUsername || 'Desconhecido',
                date: dateFormatted,
                views: views, 
                likes: likes, 
                comments: comments,
                saves: 0,
                shares: 0
            };
        });

    } catch (err: any) {
        console.error("Erro Apify Batch:", err);
        // Marca erro para todos os links do insta se o lote falhar
        instaItems.forEach((i: any) => results[i.url] = { error: 'Falha Apify' });
    }
  }

  // =================================================================================
  // 2. TIKTOK / YOUTUBE (PARALELO VIA YT-DLP)
  // =================================================================================
  if (otherItems.length > 0) {
    try {
        const binaryPath = path.join(os.tmpdir(), 'yt-dlp_linux_sheet_batch');
        await ensureBinaryExists(binaryPath);
        
        // Prepara cookies (uma vez só)
        let tempCookiePath = '';
        const hasTiktok = otherItems.some((i: any) => i.platform === 'tiktok');
        if (hasTiktok) {
            const { data: s } = await supabase.from('SETTINGS').select('value').eq('key', 'tiktok_cookies').single();
            if (s?.value) {
                tempCookiePath = path.join(os.tmpdir(), `batch-${Date.now()}.txt`);
                fs.writeFileSync(tempCookiePath, s.value);
            }
        }

        // Processa em paralelo (Promise.all)
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
            } catch (e) {
                console.error(`Erro URL ${item.url}:`, e);
                results[item.url] = { error: 'Erro Link' };
            }
        }));

        if (tempCookiePath && fs.existsSync(tempCookiePath)) fs.unlinkSync(tempCookiePath);

    } catch (err) {
        console.error("Erro Geral YT-DLP:", err);
    }
  }

  return res.status(200).json({ results });
}