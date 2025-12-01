// src/pages/api/settings/cookies.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Pega a plataforma da Query (GET) ou do Body (POST)
  const platform = (req.query.platform as string) || req.body.platform;
  
  // Define qual chave do banco usar
  let dbKey = '';
  if (platform === 'tiktok') dbKey = 'tiktok_cookies';
  if (platform === 'instagram') dbKey = 'instagram_cookies';

  if (!dbKey) return res.status(400).json({ error: 'Plataforma inválida' });

  if (req.method === 'POST') {
    const { cookies } = req.body;
    
    const { error } = await supabase
      .from('SETTINGS')
      .upsert({ key: dbKey, value: cookies });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  } 
  
  else if (req.method === 'GET') {
    const { data } = await supabase
      .from('SETTINGS')
      .select('value')
      .eq('key', dbKey)
      .single();

    return res.status(200).json({ cookies: data?.value || '' });
  }

  return res.status(405).end();
}