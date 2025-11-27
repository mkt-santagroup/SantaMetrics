// src/components/TriggerCallModal.tsx
import { useState, useMemo } from 'react';
import { CallLead } from '@/types/callLeads';
import styles from './TriggerCallModal.module.css';
import { isSameDay } from 'date-fns';
import { PhoneOutgoing, CheckCircle, Check } from 'lucide-react';

interface TriggerCallModalProps {
  data: CallLead[];
  onClose: () => void;
}

const WEBHOOK_17H = "https://n8n-n8n.deb0gd.easypanel.host/webhook/17horas";
const WEBHOOK_20H = "https://n8n-n8n.deb0gd.easypanel.host/webhook/20horas";

export default function TriggerCallModal({ data, onClose }: TriggerCallModalProps) {
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [skipReplicated, setSkipReplicated] = useState(true);
  
  // Estados de Controle
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false); // <--- NOVO ESTADO
  const [progress, setProgress] = useState<{ sent: number, total: number } | null>(null);

  // 1. Filtrar APENAS leads de HOJE
  const leadsDeHoje = useMemo(() => {
    const today = new Date();
    return data.filter(lead => {
      if (!lead.created_at) return false;
      return isSameDay(new Date(lead.created_at), today);
    });
  }, [data]);

  // 2. Aplicar regras de exclusão
  const leadsParaEnviar = useMemo(() => {
    return leadsDeHoje.filter(lead => {
      if (lead.login_no_dia === true) return false; // Já logou, ignora
      if (skipReplicated && lead.call_1 === true) return false; // Já atendeu, ignora
      return true;
    });
  }, [leadsDeHoje, skipReplicated]);

  const handleSend = async () => {
    if (!selectedWebhook || leadsParaEnviar.length === 0) return;

    setIsSending(true);
    let sentCount = 0;
    
    for (const lead of leadsParaEnviar) {
      try {
        const payload = {
          id: lead.ID, 
          numero: lead.whatsapp 
        };

        await fetch(selectedWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        sentCount++;
        setProgress({ sent: sentCount, total: leadsParaEnviar.length });
        
        await new Promise(r => setTimeout(r, 50)); 

      } catch (err) {
        console.error(`Erro ao enviar lead ${lead.ID}`, err);
      }
    }

    setIsSending(false);
    setIsSuccess(true); // <--- ATIVA A TELA DE SUCESSO
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        
        {/* --- TELA DE SUCESSO --- */}
        {isSuccess ? (
          <div className={styles.successWrapper}>
            <div className={styles.iconCircle}>
              <Check size={40} strokeWidth={4} />
            </div>
            
            <h2 className={styles.successTitle}>Disparo Concluído!</h2>
            
            <p className={styles.successText}>
              O comando foi enviado com sucesso para<br/>
              <b>{progress?.sent} contatos</b> da sua lista.
            </p>

            <div className={styles.successActions}>
              <button className={styles.btnConfirm} onClick={onClose}>
                Fechar Janela
              </button>
            </div>
          </div>
        ) : (
          /* --- TELA DE FORMULÁRIO (PADRÃO) --- */
          <>
            <div className={styles.header}>
              <h2 className={styles.title}>Disparar Ligações</h2>
              <p className={styles.subtitle}>
                Leads encontrados hoje: <b>{leadsDeHoje.length}</b>
              </p>
            </div>

            <div className={styles.body}>
              
              {/* Webhooks */}
              <div className={styles.webhookGroup}>
                <span className={styles.label}>Selecione o Horário/Webhook</span>
                
                <div 
                  className={`${styles.radioOption} ${selectedWebhook === WEBHOOK_17H ? styles.selected : ''}`}
                  onClick={() => setSelectedWebhook(WEBHOOK_17H)}
                >
                  <div style={{width:16, height:16, borderRadius:'50%', border:'4px solid', borderColor: selectedWebhook === WEBHOOK_17H ? '#000' : '#ddd'}}></div>
                  Webhook 17 Horas
                </div>

                <div 
                  className={`${styles.radioOption} ${selectedWebhook === WEBHOOK_20H ? styles.selected : ''}`}
                  onClick={() => setSelectedWebhook(WEBHOOK_20H)}
                >
                  <div style={{width:16, height:16, borderRadius:'50%', border:'4px solid', borderColor: selectedWebhook === WEBHOOK_20H ? '#000' : '#ddd'}}></div>
                  Webhook 20 Horas
                </div>
              </div>

              {/* Filtro Checkbox */}
              <label className={styles.checkboxWrapper}>
                <input 
                  type="checkbox" 
                  className={styles.checkbox}
                  checked={skipReplicated}
                  onChange={(e) => setSkipReplicated(e.target.checked)}
                />
                <span>Não ligar se lead atendeu 1ª ligação </span>
              </label>
              
              {/* Aviso Login */}
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '6px', alignItems: 'center', background: 'var(--bg-hover)', padding: '8px', borderRadius: '8px' }}>
                <CheckCircle size={14} color="#10b981" />
                <span>Leads que fizeram <b>login hoje</b> são ignorados.</span>
              </div>

              {/* Contador */}
              <div className={styles.counterBox}>
                {isSending ? (
                  <span>Enviando... {progress?.sent} / {progress?.total}</span>
                ) : (
                  <span>{leadsParaEnviar.length} contatos serão acionados</span>
                )}
              </div>

              {/* Ações */}
              <div className={styles.actions}>
                <button className={styles.btnCancel} onClick={onClose} disabled={isSending}>
                  Cancelar
                </button>
                <button 
                  className={styles.btnConfirm} 
                  onClick={handleSend}
                  disabled={!selectedWebhook || leadsParaEnviar.length === 0 || isSending}
                >
                  {isSending ? 'Disparando...' : (
                    <>
                      <PhoneOutgoing size={18} />
                      Confirmar Disparo
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}