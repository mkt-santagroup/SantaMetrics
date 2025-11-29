// src/components/TriggerCallModal.tsx
import { useState, useMemo } from 'react';
import { CallLead } from '@/types/callLeads';
import styles from './TriggerCallModal.module.css';
import { format } from 'date-fns'; 
import { PhoneOutgoing, CheckCircle, Check, Users, FlaskConical } from 'lucide-react';

interface TriggerCallModalProps {
  data: CallLead[];
  onClose: () => void;
}

const WEBHOOK_17H = "https://n8n-n8n.deb0gd.easypanel.host/webhook/17horas";
const WEBHOOK_20H = "https://n8n-n8n.deb0gd.easypanel.host/webhook/20horas";
const WEBHOOK_TEST = "https://n8n-n8n.deb0gd.easypanel.host/webhook/teste"; // <--- NOVO

export default function TriggerCallModal({ data, onClose }: TriggerCallModalProps) {
  // --- MODO DE OPERAÇÃO ---
  const [mode, setMode] = useState<'bulk' | 'manual'>('bulk');
  
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [skipReplicated, setSkipReplicated] = useState(true);
  const [manualText, setManualText] = useState(''); 
  
  // Estados de Controle
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [progress, setProgress] = useState<{ sent: number, total: number } | null>(null);

  // --- LÓGICA 1: MODO MASSA ---
  const leadsDeHoje = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return data.filter(lead => {
      if (!lead.created_at) return false;
      const leadDateStr = lead.created_at.substring(0, 10);
      return leadDateStr === todayStr;
    });
  }, [data]);

  const leadsParaEnviar = useMemo(() => {
    return leadsDeHoje.filter(lead => {
      if (lead.login_no_dia === true) return false; 
      if (skipReplicated && lead.call_1 === true) return false; 
      return true;
    });
  }, [leadsDeHoje, skipReplicated]);

  // --- LÓGICA 2: MODO MANUAL (Ajustado) ---
  const manualLeads = useMemo(() => {
    if (!manualText.trim()) return [];
    
    return manualText.split('\n')
      .map(line => {
        const numero = line.trim(); // Pega a linha inteira como número
        if (!numero) return null;
        
        // Retorna ID 0 fixo e o número colado
        return { ID: 0, whatsapp: numero }; 
      })
      .filter((l): l is { ID: number, whatsapp: string } => l !== null);
  }, [manualText]);

  // --- DISPARO UNIFICADO ---
  const handleSend = async () => {
    // Define a lista e o webhook baseado no modo
    const listToSend = mode === 'bulk' ? leadsParaEnviar : manualLeads;
    const targetWebhook = mode === 'bulk' ? selectedWebhook : WEBHOOK_TEST;

    if (!targetWebhook || listToSend.length === 0) return;

    setIsSending(true);
    let sentCount = 0;
    
    for (const item of listToSend) {
      try {
        const payload = {
          id: item.ID, 
          numero: item.whatsapp 
        };

        await fetch(targetWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        sentCount++;
        setProgress({ sent: sentCount, total: listToSend.length });
        
        await new Promise(r => setTimeout(r, 50)); 

      } catch (err) {
        console.error(`Erro ao enviar item ${item.ID}`, err);
      }
    }

    setIsSending(false);
    setIsSuccess(true);
  };

  const activeCount = mode === 'bulk' ? leadsParaEnviar.length : manualLeads.length;
  // Validação do botão: No modo manual não precisa selecionar webhook (é automático)
  const isButtonDisabled = isSending || activeCount === 0 || (mode === 'bulk' && !selectedWebhook);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        
        {isSuccess ? (
          <div className={styles.successWrapper}>
            <div className={styles.iconCircle}>
              <Check size={40} strokeWidth={4} />
            </div>
            <h2 className={styles.successTitle}>Disparo Concluído!</h2>
            <p className={styles.successText}>
              O comando foi enviado com sucesso para<br/>
              <b>{progress?.sent} contatos</b>.
            </p>
            <div className={styles.successActions}>
              <button className={styles.btnConfirm} onClick={onClose}>
                Fechar Janela
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <h2 className={styles.title}>Painel de Disparos</h2>
            </div>

            <div className={styles.tabs}>
              <button 
                className={`${styles.tabBtn} ${mode === 'bulk' ? styles.tabActive : ''}`}
                onClick={() => setMode('bulk')}
              >
                <Users size={16} /> Disparo em Massa
              </button>
              <button 
                className={`${styles.tabBtn} ${mode === 'manual' ? styles.tabActive : ''}`}
                onClick={() => setMode('manual')}
              >
                <FlaskConical size={16} /> Teste Manual
              </button>
            </div>

            <div className={styles.body}>
              
              {/* --- MODO MASSA --- */}
              {mode === 'bulk' && (
                <>
                  <p className={styles.subtitle} style={{textAlign: 'center', marginTop: 0}}>
                    Leads elegíveis de hoje: <b>{leadsDeHoje.length}</b>
                  </p>

                  <label className={styles.checkboxWrapper}>
                    <input 
                      type="checkbox" 
                      className={styles.checkbox}
                      checked={skipReplicated}
                      onChange={(e) => setSkipReplicated(e.target.checked)}
                    />
                    <span>Ignorar se já atendeu 1ª ligação</span>
                  </label>
                  
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '6px', alignItems: 'center', background: 'var(--bg-hover)', padding: '8px', borderRadius: '8px' }}>
                    <CheckCircle size={14} color="#10b981" />
                    <span>Leads com login hoje são sempre ignorados.</span>
                  </div>

                  <hr style={{border:0, borderTop:'1px solid var(--border-color)', margin:0}}/>

                  {/* Seleção de Webhook só aparece no Bulk */}
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
                </>
              )}

              {/* --- MODO MANUAL --- */}
              {mode === 'manual' && (
                <div className={styles.manualInputContainer}>
                  <span className={styles.label}>Cole APENAS OS NÚMEROS (Um por linha)</span>
                  <textarea 
                    className={styles.textarea}
                    placeholder={`5511999999999\n5521988888888`}
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                  />
                  <span className={styles.helperText}>
                    O ID será enviado como 0 automaticamente.
                  </span>
                  
                  <div style={{ marginTop: '1rem', padding: '10px', background: 'var(--bg-hover)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <b>Destino:</b> Webhook de Teste (/webhook/teste)
                  </div>
                </div>
              )}

              {/* CONTADOR E BOTÕES */}
              <div className={styles.counterBox}>
                {isSending ? (
                  <span>Enviando... {progress?.sent} / {progress?.total}</span>
                ) : (
                  <span>{activeCount} contatos prontos para envio</span>
                )}
              </div>

              <div className={styles.actions}>
                <button className={styles.btnCancel} onClick={onClose} disabled={isSending}>
                  Cancelar
                </button>
                <button 
                  className={styles.btnConfirm} 
                  onClick={handleSend}
                  disabled={isButtonDisabled}
                >
                  {isSending ? 'Disparando...' : (
                    <>
                      <PhoneOutgoing size={18} />
                      {mode === 'bulk' ? 'Confirmar Disparo' : 'Enviar Teste'}
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