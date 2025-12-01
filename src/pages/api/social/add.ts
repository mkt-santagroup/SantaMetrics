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

    // ============================================================
    // PREPARAÇÃO DE COOKIES (TIKTOK E INSTAGRAM)
    // ============================================================
    if (platform === 'tiktok' || platform === 'instagram') {
        const dbKey = platform === 'tiktok' ? 'tiktok_cookies' : 'instagram_cookies';
        
        const { data: settings } = await supabase
            .from('SETTINGS')
            .select('value')
            .eq('key', dbKey)
            .single();

        if (!settings?.value) {
            return res.status(400).json({ error: `Cookies do ${platform} não configurados. Vá na engrenagem!` });
        }

        // Cria arquivo temporário
        tempCookiePath = path.join(os.tmpdir(), `${platform}-cookies-${Date.now()}.txt`);
        fs.writeFileSync(tempCookiePath, settings.value);
    }

    // ============================================================
    // EXECUÇÃO DO YT-DLP (COM TIMEOUT DE 20 SEGUNDOS)
    // ============================================================
    
    // Monta o comando base
    // --dump-json: Retorna JSON
    // --skip-download: Não baixa o vídeo, só metadados
    // --no-warnings: Limpa o output
    let command = `yt-dlp --dump-json --skip-download --no-warnings "${url}"`;

    // Se tiver cookie, adiciona no comando junto com User-Agent para evitar bloqueios
    if (tempCookiePath) {
        const userAgent = '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"';
        command = `yt-dlp --dump-json --skip-download --no-warnings --cookies "${tempCookiePath}" --user-agent ${userAgent} "${url}"`;
    }

    console.log(`Executando yt-dlp para ${platform}...`);
    
    // Timeout de 20s para não travar o painel em loop infinito
    const { stdout } = await execPromise(command, { timeout: 20000 });
    
    if (!stdout) throw new Error("Sem resposta do yt-dlp");

    const output = JSON.parse(stdout);

    // ============================================================
    // EXTRAÇÃO DE DADOS (MAPEAMENTO INTELIGENTE)
    // ============================================================
    
    // Views: Tenta pegar view_count (vídeos) ou play_count (Reels)
    const views = output.view_count || output.play_count || 0;
    
    // Share count: YouTube não tem, TikTok é repost_count, Insta as vezes não tem
    const shares = output.repost_count || output.share_count || 0;

    // Autor: Tenta pegar o uploader, canal ou user
    const author = output.uploader || output.channel || output.uploader_id || 'Desconhecido';

    extractedData = {
        views: views,
        likes: output.like_count || 0,
        coments: output.comment_count || 0,
        saves: output.save_count || 0, // Alguns metadados trazem saves
        shares: shares,
        name_account: author,
        thumbnail: output.thumbnail || '', // Pega a thumb nativa
    };

    console.log("✅ Dados Extraídos com Sucesso:", extractedData);

    // ============================================================
    // SALVAR NO BANCO
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
    console.error("❌ Erro ao processar:", url);
    console.error(err.message || err);
    
    // Retorna erro 500 mas com JSON válido para o frontend não travar esperando
    return res.status(500).json({ 
        error: 'Erro ao processar URL. Tempo excedido ou link inválido.', 
        details: err.message 
    });
  } finally {
    // Limpeza do arquivo de cookie temporário
    if (tempCookiePath && fs.existsSync(tempCookiePath)) {
        try { fs.unlinkSync(tempCookiePath); } catch(e) {}
    }
  }
}