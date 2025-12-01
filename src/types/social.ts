// src/types/social.ts

// Tipo exato de como os dados vêm do Supabase
export interface SocialMetricDB {
  url: string; // PK
  created_at: string;
  name_account: string | null;
  views: number | null;
  likes: number | null;
  coments: number | null;
  saves: number | null;
  shares: number | null;
  thumbnail: string | null; // <--- NOVO CAMPO
}

// Tipo unificado para usar no Front-end
export interface SocialMetric {
  platform: 'tiktok' | 'instagram' | 'youtube';
  url: string;
  username: string;
  views: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  thumbnail: string; // <--- NOVO CAMPO
  last_updated: string;
}