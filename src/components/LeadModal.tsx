import { Lead } from '@/types/leads';
import styles from './LeadModal.module.css';
import { X, Calendar, User, Phone, Layout, Monitor } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getStageName } from '@/utils/stageMap'; // <--- IMPORT NOVO

interface LeadModalProps {
  lead: Lead;
  onClose: () => void;
}

export default function LeadModal({ lead, onClose }: LeadModalProps) {
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const formatPhone = (phone: string | null) => {
      if (!phone) return '-';
      let cleaned = phone.replace(/\D/g, '');
      if (cleaned.startsWith('55') && cleaned.length > 11) cleaned = cleaned.substring(2);
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Detalhes do Lead #{lead.id}</h2>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={24} />
          </button>
        </div>
        
        <div className={styles.body}>
          <div className={styles.grid}>
            <div className={styles.section}>
              <span className={styles.label}><User size={12}/> Nome</span>
              <div className={styles.value}>{lead.nome || 'Não informado'}</div>
            </div>
            
            <div className={styles.section}>
              <span className={styles.label}><Phone size={12}/> Número</span>
              <div className={styles.value}>{formatPhone(lead.numero)}</div>
            </div>

            {/* ETAPA COM NOME BONITO */}
            <div className={styles.section}>
              <span className={styles.label}><Layout size={12}/> Etapa Atual</span>
              <div className={styles.value} style={{fontWeight: 700}}>
                {getStageName(lead.etapa)}
              </div>
            </div>

            <div className={styles.section}>
              <span className={styles.label}><Monitor size={12}/> Tem PC?</span>
              <div className={styles.value}>{lead.tem_pc || '-'}</div>
            </div>

             <div className={styles.section}>
              <span className={styles.label}><Calendar size={12}/> Data de Entrada</span>
              <div className={styles.value}>
                 {format(new Date(lead.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>
          </div>
          {/* ... resto do modal igual ... */}
          <hr style={{ border: '0', borderTop: '1px solid #e5e5e5', margin: '1rem 0' }} />
          <div className={styles.section}>
            <span className={styles.label}>Observações</span>
            <div className={`${styles.value} ${styles.longText}`}>
              {lead.observacoes || 'Nenhuma observação registrada.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}