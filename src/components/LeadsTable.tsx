import { Lead } from '@/types/leads';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import styles from './LeadsTable.module.css';
import { Monitor, AlertCircle } from 'lucide-react';
import { getStageName } from '@/utils/stageMap';

interface LeadsTableProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
}

export default function LeadsTable({ leads, onSelectLead }: LeadsTableProps) {
  
  const formatPhone = (phone: string | null) => {
    if (!phone) return '-';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('55') && cleaned.length > 11) {
      cleaned = cleaned.substring(2);
    }
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colDate}>Data e Hora</th>
            <th>Número</th>
            <th>Nome</th>
            <th>Etapa Atual</th>
            <th className={styles.colCenter}>Tem PC?</th>
            <th>Observações</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const textoPC = lead.tem_pc || '-';
            const ehPositivo = textoPC.toLowerCase().includes('sim');
            const friendlyStage = getStageName(lead.etapa);

            return (
              <tr 
                key={lead.id} 
                onClick={() => onSelectLead(lead)} 
                className={styles.clickableRow}
              >
                <td className={styles.dateCell}>
                  {format(new Date(lead.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                </td>
                <td className={styles.phoneCell}>
                  {formatPhone(lead.numero)}
                </td>
                <td className={styles.nameCell}>
                  <div className={styles.nameWrapper}>
                    {lead.spam && (
                      <span title="Possível SPAM" style={{ display: 'flex', alignItems: 'center' }}>
                         <AlertCircle size={14} className={styles.spamIcon} />
                      </span>
                    )}
                    {lead.nome || <span className={styles.unknown}>Desconhecido</span>}
                  </div>
                </td>
                
                <td>
                  <span className={styles.badge} title={lead.etapa || ''}>
                    {friendlyStage}
                  </span>
                </td>

                <td className={styles.colCenter}>
                  {lead.tem_pc ? (
                    <div className={ehPositivo ? styles.pcBadgeActive : styles.pcBadgeNeutral}>
                      {ehPositivo && <Monitor size={14} />} 
                      <span>{lead.tem_pc}</span>
                    </div>
                  ) : (
                    <span className={styles.pcBadgeInactive}>-</span>
                  )}
                </td>
                <td className={styles.obsCell}>
                  {lead.observacoes ? (
                    <span className={styles.obsText} title={lead.observacoes}>
                      {lead.observacoes}
                    </span>
                  ) : (
                    <span className={styles.emptyObs}>-</span>
                  )}
                </td>
              </tr>
            );
          })}
          {leads.length === 0 && (
            <tr>
              <td colSpan={6} className={styles.emptyState}>
                Nenhum lead encontrado neste período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}