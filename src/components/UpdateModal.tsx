import { useEffect, useState } from 'react';
import styles from './AddUrlModal.module.css'; // Reutilizando estilo
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { SocialMetric } from '@/types/social';

interface UpdateModalProps {
  itemsToUpdate: SocialMetric[]; // Lista de itens para atualizar
  onClose: () => void;
  onFinish: () => void;
}

export default function UpdateModal({ itemsToUpdate, onClose, onFinish }: UpdateModalProps) {
  const [current, setCurrent] = useState(0);
  const [status, setStatus] = useState<'processing' | 'done'>('processing');
  const [errors, setErrors] = useState<number>(0);

  useEffect(() => {
    const processQueue = async () => {
      let errorCount = 0;

      for (let i = 0; i < itemsToUpdate.length; i++) {
        setCurrent(i + 1);
        const item = itemsToUpdate[i];

        try {
          // Reutiliza a API de adicionar para atualizar os dados
          await fetch('/api/social/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: item.platform, url: item.url })
          });
        } catch (err) {
          console.error(`Erro ao atualizar ${item.url}`, err);
          errorCount++;
        }
      }

      setErrors(errorCount);
      setStatus('done');
    };

    if (itemsToUpdate.length > 0) {
      processQueue();
    } else {
      setStatus('done');
    }
  }, [itemsToUpdate]);

  const progressPercent = itemsToUpdate.length > 0 ? (current / itemsToUpdate.length) * 100 : 100;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} style={{textAlign:'center'}}>
        
        {status === 'processing' ? (
          <>
            <div style={{marginBottom:'1rem'}}>
              <RefreshCw size={40} className={styles.spin} style={{color:'var(--accent-color)'}} />
            </div>
            <h3 style={{margin:0, color:'var(--text-primary)'}}>Atualizando Métricas...</h3>
            <p style={{color:'var(--text-secondary)', fontSize:'0.9rem'}}>
              Processando {current} de {itemsToUpdate.length} links
            </p>
            
            {/* Barra de Progresso */}
            <div style={{width:'100%', height:'8px', background:'var(--bg-hover)', borderRadius:'4px', marginTop:'1rem', overflow:'hidden'}}>
              <div style={{
                width: `${progressPercent}%`, 
                height:'100%', 
                background:'var(--accent-color)',
                transition: 'width 0.3s ease'
              }}/>
            </div>
            
            <p style={{fontSize:'0.75rem', color:'var(--text-tertiary)', marginTop:'1rem'}}>
              Por favor, não feche esta janela.
            </p>
          </>
        ) : (
          <>
            <div style={{marginBottom:'1rem'}}>
              <CheckCircle size={40} style={{color:'#10b981'}} />
            </div>
            <h3 style={{margin:0, color:'var(--text-primary)'}}>Atualização Concluída!</h3>
            <p style={{color:'var(--text-secondary)', fontSize:'0.9rem', marginBottom: '1.5rem'}}>
              {itemsToUpdate.length - errors} atualizados com sucesso.<br/>
              {errors > 0 && <span style={{color:'#ef4444'}}>{errors} falharam.</span>}
            </p>
            
            <button className={styles.saveBtn} onClick={onFinish}>
              Fechar e Recarregar
            </button>
          </>
        )}

      </div>
    </div>
  );
}