import { useState } from 'react';
import styles from './SocialFilterToolbar.module.css';
import { Eye, Heart, MessageCircle, ArrowUp, ArrowDown, Video, Instagram, Youtube, LayoutGrid } from 'lucide-react';

export type SocialSortOption = 'views' | 'likes' | 'comments';
export type SocialSortDirection = 'desc' | 'asc';
export type SocialPlatformFilter = 'all' | 'tiktok' | 'instagram' | 'youtube';

interface SocialFilterToolbarProps {
  activePlatform: SocialPlatformFilter;
  onPlatformChange: (platform: SocialPlatformFilter) => void;
  sortBy: SocialSortOption;
  onSortByChange: (sort: SocialSortOption) => void;
  sortDirection: SocialSortDirection;
  onSortDirectionChange: (dir: SocialSortDirection) => void;
}

export default function SocialFilterToolbar({
  activePlatform,
  onPlatformChange,
  sortBy,
  onSortByChange,
  sortDirection,
  onSortDirectionChange
}: SocialFilterToolbarProps) {

  const handleSortClick = (option: SocialSortOption) => {
    if (sortBy === option) {
      // Se clicar no mesmo, inverte a direção
      onSortDirectionChange(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      // Se clicar em outro, seta ele e reseta para desc
      onSortByChange(option);
      onSortDirectionChange('desc');
    }
  };

  const getSortIcon = (option: SocialSortOption) => {
    if (sortBy !== option) return null;
    return sortDirection === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />;
  };

  return (
    <div className={styles.toolbarContainer}>
      
      {/* GRUPO 1: PLATAFORMAS */}
      <div className={styles.filterGroup}>
        <span className={styles.groupLabel}>Plataforma</span>
        <div className={styles.buttonsRow}>
          <button 
            className={`${styles.filterBtn} ${activePlatform === 'all' ? styles.active : ''}`}
            onClick={() => onPlatformChange('all')}
          >
            <LayoutGrid size={16} /> Todos
          </button>
          <button 
            className={`${styles.filterBtn} ${activePlatform === 'tiktok' ? styles.activeTiktok : ''}`}
            onClick={() => onPlatformChange('tiktok')}
          >
            <Video size={16} /> TikTok
          </button>
          <button 
            className={`${styles.filterBtn} ${activePlatform === 'instagram' ? styles.activeInsta : ''}`}
            onClick={() => onPlatformChange('instagram')}
          >
            <Instagram size={16} /> Insta
          </button>
          <button 
            className={`${styles.filterBtn} ${activePlatform === 'youtube' ? styles.activeYoutube : ''}`}
            onClick={() => onPlatformChange('youtube')}
          >
            <Youtube size={16} /> YouTube
          </button>
        </div>
      </div>

      <div className={styles.divider} />

      {/* GRUPO 2: ORDENAÇÃO */}
      <div className={styles.filterGroup}>
        <span className={styles.groupLabel}>Ordenar Por</span>
        <div className={styles.buttonsRow}>
          <button 
            className={`${styles.filterBtn} ${sortBy === 'views' ? styles.activeSort : ''}`}
            onClick={() => handleSortClick('views')}
          >
            <Eye size={16} /> Views {getSortIcon('views')}
          </button>
          
          <button 
            className={`${styles.filterBtn} ${sortBy === 'likes' ? styles.activeSort : ''}`}
            onClick={() => handleSortClick('likes')}
          >
            <Heart size={16} /> Likes {getSortIcon('likes')}
          </button>
          
          <button 
            className={`${styles.filterBtn} ${sortBy === 'comments' ? styles.activeSort : ''}`}
            onClick={() => handleSortClick('comments')}
          >
            <MessageCircle size={16} /> Comentários {getSortIcon('comments')}
          </button>
        </div>
      </div>

    </div>
  );
}