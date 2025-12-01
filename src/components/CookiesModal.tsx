// src/components/CookiesModal.tsx
import { useState, useEffect, useRef } from 'react';
import styles from './AddUrlModal.module.css';
import { X, Save, Upload, FileText, Video, Instagram } from 'lucide-react';

export default function CookiesModal({ onClose }: { onClose: () => void }) {
  const [platform, setPlatform] = useState<'tiktok' | 'instagram'>('tiktok');
  const [cookies, setCookies] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega o cookie quando troca de aba
  useEffect(() => {
    setCookies(''); // Limpa visualmente enquanto carrega
    fetch(`/api/settings/cookies?platform=${platform}`)
      .then(res => res.json())
      .then(data => {
        if (data.cookies) setCookies(data.cookies);
      });
  }, [platform]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') setCookies(text);
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    if (!cookies.trim()) return alert('Cole o conteúdo ou carregue um arquivo.');
    setLoading(true);
    try {
      await fetch('/api/settings/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, cookies })
      });
      alert(`Cookies do ${platform} salvos!`);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>Configurar Cookies</h3>
          <button onClick={onClose} className={styles.closeBtn}><X size={20}/></button>
        </div>

        <div className={styles.body}>
          
          {/* ABAS DE SELEÇÃO */}
          <div className={styles.toggleGroup} style={{marginBottom: '1rem'}}>
            <button 
              className={`${styles.toggleBtn} ${platform === 'tiktok' ? styles.activeTiktok : ''}`}
              onClick={() => setPlatform('tiktok')}
            >
              <Video size={16} /> TikTok
            </button>
            <button 
              className={`${styles.toggleBtn} ${platform === 'instagram' ? styles.activeInsta : ''}`}
              onClick={() => setPlatform('instagram')}
            >
              <Instagram size={16} /> Instagram
            </button>
          </div>

          {/* Botão Upload */}
          <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
            <input type="file" ref={fileInputRef} accept=".txt" style={{ display: 'none' }} onChange={handleFileUpload}/>
            <button 
              className={styles.saveBtn} 
              style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)', border:'1px solid var(--border-color)' }} 
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={18} /> Carregar cookies.txt
            </button>
          </div>

          <div className={styles.inputGroup}>
            <label>CONTEÚDO DO COOKIE ({platform.toUpperCase()}):</label>
            <textarea 
              className={styles.input} 
              style={{height: '180px', fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'pre'}}
              value={cookies}
              onChange={(e) => setCookies(e.target.value)}
              placeholder="# Netscape HTTP Cookie File..."
            />
            <p style={{fontSize:'0.7rem', color:'var(--text-secondary)', marginTop:5, display: 'flex', gap: 6, alignItems:'center'}}>
              <FileText size={12}/> Use a extensão "Get cookies.txt LOCALLY" no navegador.
            </p>
          </div>

          <button className={styles.saveBtn} onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : <><Save size={18}/> Salvar Configuração</>}
          </button>
        </div>
      </div>
    </div>
  );
}