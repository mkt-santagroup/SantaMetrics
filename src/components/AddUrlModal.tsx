import { useState } from 'react';
import styles from './AddUrlModal.module.css';
import { X, Youtube, Video, Instagram, Plus } from 'lucide-react';

interface AddUrlModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddUrlModal({ onClose, onSuccess }: AddUrlModalProps) {
  const [platform, setPlatform] = useState<'youtube' | 'tiktok' | 'instagram'>('youtube');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!url) return;
    setLoading(true);

    try {
      // Chama a nossa API (que vamos criar no passo 4)
      const response = await fetch('/api/social/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, url }),
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        alert('Erro ao adicionar URL. Verifique o link.');
      }
    } catch (error) {
      console.error(error);
      alert('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>Adicionar Conteúdo</h3>
          <button onClick={onClose} className={styles.closeBtn}><X size={20}/></button>
        </div>

        <div className={styles.body}>
          <div className={styles.inputGroup}>
            <label>Plataforma</label>
            <div className={styles.toggleGroup}>
              <button 
                className={`${styles.toggleBtn} ${platform === 'youtube' ? styles.activeYoutube : ''}`}
                onClick={() => setPlatform('youtube')}
              >
                <Youtube size={18} /> YouTube
              </button>
              <button 
                className={`${styles.toggleBtn} ${platform === 'tiktok' ? styles.activeTiktok : ''}`}
                onClick={() => setPlatform('tiktok')}
              >
                <Video size={18} /> TikTok
              </button>
              <button 
                className={`${styles.toggleBtn} ${platform === 'instagram' ? styles.activeInsta : ''}`}
                onClick={() => setPlatform('instagram')}
              >
                <Instagram size={18} /> Instagram
              </button>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label>URL do Vídeo/Post</label>
            <input 
              type="text" 
              placeholder="Cole o link aqui..." 
              className={styles.input}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <button 
            className={styles.saveBtn} 
            onClick={handleSave} 
            disabled={loading || !url}
          >
            {loading ? 'Processando...' : <><Plus size={18}/> Adicionar e Buscar Dados</>}
          </button>
        </div>
      </div>
    </div>
  );
}