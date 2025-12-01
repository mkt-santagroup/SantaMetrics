// src/components/ViewsDashboard.tsx
import { useState, useEffect, useMemo } from 'react';
import styles from './ViewsDashboard.module.css';
import { 
  Instagram, Youtube, Video, Eye, Plus, RefreshCw, 
  ExternalLink, Trash2, Settings 
} from 'lucide-react';
import { SocialMetric, SocialMetricDB } from '@/types/social';
import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AddUrlModal from './AddUrlModal';
import CookiesModal from './CookiesModal';
import UpdateModal from './UpdateModal';
import SocialFilterToolbar, { SocialPlatformFilter, SocialSortOption, SocialSortDirection } from './SocialFilterToolbar';

export default function ViewsDashboard() {
  // ESTADOS DE FILTRO (AGORA COMPLETOS)
  const [activePlatform, setActivePlatform] = useState<SocialPlatformFilter>('all');
  const [sortBy, setSortBy] = useState<SocialSortOption>('views');
  const [sortDirection, setSortDirection] = useState<SocialSortDirection>('desc');

  const [data, setData] = useState<SocialMetric[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modais
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCookiesModal, setShowCookiesModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  async function fetchSocialData() {
    setLoading(true);
    try {
      const [resTiktok, resInsta, resYoutube] = await Promise.all([
        supabase.from('VIEWS-TIKTOK').select('*'),
        supabase.from('VIEWS-INSTAGRAM').select('*'),
        supabase.from('VIEWS-YOUTUBE').select('*')
      ]);

      const formattedData: SocialMetric[] = [];

      const normalize = (items: any[], platform: 'tiktok' | 'instagram' | 'youtube') => {
        return items.map((item: SocialMetricDB) => ({
          platform,
          url: item.url,
          username: item.name_account || 'Desconhecido',
          views: Number(item.views) || 0,
          likes: Number(item.likes) || 0,
          comments: Number(item.coments) || 0,
          saves: Number(item.saves) || 0,
          shares: Number(item.shares) || 0,
          thumbnail: item.thumbnail || '',
          last_updated: item.created_at
        }));
      };

      if (resTiktok.data) formattedData.push(...normalize(resTiktok.data, 'tiktok'));
      if (resInsta.data) formattedData.push(...normalize(resInsta.data, 'instagram'));
      if (resYoutube.data) formattedData.push(...normalize(resYoutube.data, 'youtube'));

      setData(formattedData);
    } catch (error) {
      console.error("Erro ao buscar views:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSocialData();
  }, []);

  // --- LÓGICA DE FILTRO E ORDENAÇÃO (USEMEMO) ---
  const processedData = useMemo(() => {
    let result = [...data];

    // 1. Filtrar Plataforma
    if (activePlatform !== 'all') {
      result = result.filter(item => item.platform === activePlatform);
    }

    // 2. Ordenar
    result.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      switch (sortBy) {
        case 'views': valA = a.views; valB = b.views; break;
        case 'likes': valA = a.likes; valB = b.likes; break;
        case 'comments': valA = a.comments; valB = b.comments; break;
      }

      if (sortDirection === 'asc') {
        return valA - valB;
      } else {
        return valB - valA; // Descendente (Padrão)
      }
    });

    return result;
  }, [data, activePlatform, sortBy, sortDirection]);

  // --- OUTRAS FUNÇÕES (MANTIDAS) ---
  const handleRefresh = () => {
    if (processedData.length === 0) {
      alert("Não há itens para atualizar nesta visualização.");
      return;
    }
    setShowUpdateModal(true);
  };

  const handleDelete = async (url: string, platform: string) => {
    if (!confirm("Tem certeza que deseja remover este link?")) return;
    try {
      const response = await fetch('/api/social/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, platform })
      });
      if (response.ok) {
        setData(prev => prev.filter(item => item.url !== url));
      } else {
        alert("Erro ao excluir.");
      }
    } catch (error) { console.error(error); }
  };

  const formatExact = (num: number) => new Intl.NumberFormat('pt-BR').format(num);
  const formatDate = (dateStr: string) => dateStr ? format(new Date(dateStr), "dd/MM/yy HH:mm", { locale: ptBR }) : '-';
  
  const getPlatformIcon = (platform: string) => {
    switch(platform) {
      case 'tiktok': return <Video size={16} />;
      case 'instagram': return <Instagram size={16} />;
      case 'youtube': return <Youtube size={16} />;
      default: return <Eye size={16} />;
    }
  };

  const getPlatformColor = (platform: string) => {
    switch(platform) {
      case 'tiktok': return 'var(--text-primary)';
      case 'instagram': return '#E1306C';
      case 'youtube': return '#FF0000';
      default: return 'var(--text-primary)';
    }
  };

  return (
    <div className={styles.container}>
      
      {/* HEADER */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'2rem'}}>
        <div className={styles.header} style={{marginBottom:0}}>
          <h2 className={styles.title}>Métricas Sociais</h2>
          <p className={styles.subtitle}>Dados brutos de engajamento.</p>
        </div>
        
        <div style={{display:'flex', gap:'10px'}}>
          <button className={styles.actionIconBtn} onClick={() => setShowCookiesModal(true)} title="Configurar Cookies">
            <Settings size={18} />
          </button>
          <button className={styles.actionIconBtn} onClick={handleRefresh} title="Atualizar Dados Listados">
            <RefreshCw size={18} />
          </button>
          <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
            <Plus size={18} /> Adicionar URL
          </button>
        </div>
      </div>

      {/* NOVO COMPONENTE DE FILTRO */}
      <SocialFilterToolbar 
        activePlatform={activePlatform}
        onPlatformChange={setActivePlatform}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortDirection={sortDirection}
        onSortDirectionChange={setSortDirection}
      />

      {/* TABELA */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>Carregando tabela...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{width: '50px', textAlign: 'center'}}>Rede</th>
                <th style={{width: '80px', textAlign: 'center'}}>Thumb</th>
                <th style={{textAlign: 'left'}}>Conta / Canal</th>
                <th className={styles.textRight}>Views</th>
                <th className={styles.textRight}>Likes</th>
                <th className={styles.textRight}>Comentários</th>
                <th className={styles.textRight}>Salvos</th>
                <th className={styles.textRight}>Shares</th>
                <th className={styles.textRight}>Atualização</th>
                <th style={{textAlign: 'center', width: '80px'}}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {processedData.map((item) => (
                <tr key={item.url}>
                  <td style={{textAlign: 'center'}}>
                    <div className={styles.iconBox} style={{color: getPlatformColor(item.platform)}}>
                      {getPlatformIcon(item.platform)}
                    </div>
                  </td>
                  
                  <td style={{textAlign: 'center'}}>
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt="Thumb" style={{width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'block', margin: '0 auto'}} />
                    ) : (
                      <div style={{width:'50px', height:'50px', background:'var(--bg-hover)', borderRadius:'8px', margin:'0 auto', opacity:0.5}} />
                    )}
                  </td>

                  <td className={styles.fontBold}>
                    <div style={{display:'flex', flexDirection:'column'}}>
                      <span>{item.username}</span>
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.linkTiny}>
                        {item.url.substring(0, 30)}... <ExternalLink size={10} />
                      </a>
                    </div>
                  </td>

                  <td className={styles.textRight}>{formatExact(item.views)}</td>
                  <td className={styles.textRight}>{formatExact(item.likes)}</td>
                  <td className={styles.textRight}>{formatExact(item.comments)}</td>
                  <td className={styles.textRight}>{formatExact(item.saves)}</td>
                  <td className={styles.textRight}>{formatExact(item.shares)}</td>
                  
                  <td className={`${styles.textRight} ${styles.dateCell}`}>
                    {formatDate(item.last_updated)}
                  </td>
                  
                  <td style={{textAlign: 'center'}}>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(item.url, item.platform)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {processedData.length === 0 && (
                <tr>
                  <td colSpan={10} className={styles.emptyState}>Nenhum registro encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAIS */}
      {showAddModal && <AddUrlModal onClose={() => setShowAddModal(false)} onSuccess={() => fetchSocialData()} />}
      {showCookiesModal && <CookiesModal onClose={() => setShowCookiesModal(false)} />}
      {showUpdateModal && <UpdateModal itemsToUpdate={processedData} onClose={() => setShowUpdateModal(false)} onFinish={() => { setShowUpdateModal(false); fetchSocialData(); }} />}
    </div>
  );
}