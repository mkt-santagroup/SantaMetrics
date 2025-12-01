// src/pages/api/social/delete.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return res.status(405).end();

  const { platform, url } = req.body;

  if (!url || !platform) return res.status(400).json({ error: 'Dados incompletos' });

  try {
    const tableName = 
      platform === 'youtube' ? 'VIEWS-YOUTUBE' : 
      platform === 'tiktok' ? 'VIEWS-TIKTOK' : 'VIEWS-INSTAGRAM';

    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('url', url);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao excluir' });
  }
}