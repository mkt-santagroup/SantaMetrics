// src/components/TriggerCallModal.tsx
import { useState, useMemo } from 'react';
import { CallLead } from '@/types/callLeads';
import styles from './TriggerCallModal.module.css';
import { format, parseISO, subDays, startOfDay, isSameDay } from 'date-fns'; 
import { ptBR } from 'date-fns/locale';
import { PhoneOutgoing, Check, Users, FlaskConical } from 'lucide-react';

interface TriggerCallModalProps {
  data: CallLead[];
  onClose: () => void;
}

const WEBHOOK_17H = "https://n8n-n8n.deb0gd.easypanel.host/webhook/17horas";
const WEBHOOK_20H = "https://n8n-n8n.deb0gd.easypanel.host/webhook/20horas";
const WEBHOOK_TEST = "https://n8n-n8n.deb0gd.easypanel.host/webhook/teste";

export default function TriggerCallModal({ data, onClose }: TriggerCallModalProps) {
  const [mode, setMode] = useState<'bulk' | 'manual'>('bulk');
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  
  // Checkbox de filtro (padrão marcado)
  const [skipReplicated, setSkipReplicated] = useState(true);
  
  // Inicia com HOJE selecionado por padrão
  const [selectedDates, setSelectedDates] = useState<string[]>([
    format(new Date(), 'yyyy-MM-dd')
  ]);

  const [manualText, setManualText] = useState(''); 
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [progress, setProgress] = useState<{ sent: number, total: number } | null>(null);

  // --- 1. VISUALIZAÇÃO DOS CARDS (LÓGICA PURA) ---
  // Conta TODOS os leads criados no dia, igual ao Dashboard
  const last7DaysData = useMemo(() => {
    const today = startOfDay(new Date());
    const daysMap = new Map<string, { label: string, subLabel?: string, count: number, dateKey: string }>();

    // Cria os slots dos últimos 7 dias
    for (let i = 0; i < 7; i++) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd'); // Chave local
      
      let label = format(d, "EEE", { locale: ptBR }).toUpperCase(); 
      let subLabel = format(d, "dd/MM");

      if (isSameDay(d, today)) { label = "HOJE"; subLabel = format(d, "dd/MM"); }
      else if (isSameDay(d, subDays(today, 1))) { label = "ONTEM"; subLabel = format(d, "dd/MM"); }

      daysMap.set(key, { label, subLabel, count: 0, dateKey: key });
    }

    // Loop simples: Se tem data válida, conta no dia correspondente.
    // SEM FILTROS DE STATUS OU LOGIN AQUI.
    data.forEach(lead => {
      if (!lead.created_at) return;
      
      // Converte UTC do banco para data local (mesma lógica do Dashboard)
      const localDate = parseISO(lead.created_at);
      const key = format(localDate, 'yyyy-MM-dd');

      if (daysMap.has(key)) {
        daysMap.get(key)!.count++;
      }
    });

    return Array.from(daysMap.values());
  }, [data]); 

  // Separação visual: 2 em cima (Hoje/Ontem), 5 embaixo
  const topDays = last7DaysData.slice(0, 2);
  const bottomDays = last7DaysData.slice(2);

  // --- LÓGICA DE SELEÇÃO ---
  const allSelected = last7DaysData.every(d => selectedDates.includes(d.dateKey));
  
  const handleSelectAll = () => {
    if (allSelected) setSelectedDates([]);
    else setSelectedDates(last7DaysData.map(d => d.dateKey));
  };

  const toggleDate = (dateKey: string) => {
    setSelectedDates(prev => prev.includes(dateKey) ? prev.filter(d => d !== dateKey) : [...prev, dateKey]);
  };

  // --- 2. LISTA DE ENVIO (FILTRADA) ---
  // Aqui aplicamos os filtros de segurança na hora de disparar
  const leadsParaEnviar = useMemo(() => {
    const selectedSet = new Set(selectedDates);
    
    return data.filter(lead => {
      if (!lead.created_at) return false;
      
      const localDate = parseISO(lead.created_at);
      const key = format(localDate, 'yyyy-MM-dd');

      // 1. O dia foi selecionado?
      if (!selectedSet.has(key)) return false;

      // 2. Segurança: Já logou hoje? (Sempre filtra para não incomodar cliente ativo)
      if (lead.login_no_dia === true) return false;

      // 3. Filtro Opcional: Já atendeu? (Controlado pelo checkbox)
      const jaAtendeu = lead.called || lead.called2 || (lead.call1_status && lead.call1_status !== 'NULL' && lead.call1_status !== '');
      if (skipReplicated && jaAtendeu) return false;

      return true;
    });
  }, [data, selectedDates, skipReplicated]);

  // --- 3. MODO MANUAL ---
  const manualLeads = useMemo(() => {
    if (!manualText.trim()) return [];
    return manualText.split('\n')
      .map(l => { const n = l.trim(); return n ? { ID: 0, whatsapp: n } : null; })
      .filter((l): l is { ID: number, whatsapp: string } => l !== null);
  }, [manualText]);

  // --- DISPARO ---
  const handleSend = async () => {
    const listToSend = mode === 'bulk' ? leadsParaEnviar : manualLeads;
    const targetWebhook = mode === 'bulk' ? selectedWebhook : WEBHOOK_TEST;

    if (!targetWebhook || listToSend.length === 0) return;

    setIsSending(true);
    let sentCount = 0;
    
    for (const item of listToSend) {
      try {
        await fetch(targetWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.ID, numero: item.whatsapp })
        });
        sentCount++;
        setProgress({ sent: sentCount, total: listToSend.length });
        await new Promise(r => setTimeout(r, 50)); 
      } catch (err) { console.error(err); }
    }
    setIsSending(false);
    setIsSuccess(true);
  };

  const activeCount = mode === 'bulk' ? leadsParaEnviar.length : manualLeads.length;
  const isButtonDisabled = isSending || activeCount === 0 || (mode === 'bulk' && !selectedWebhook);

  // Componente Visual do Card de Data
  const DateCard = ({ item }: { item: typeof last7DaysData[0] }) => (
    <div 
      className={`${styles.dateItem} ${selectedDates.includes(item.dateKey) ? styles.dateItemActive : ''}`}
      onClick={() => toggleDate(item.dateKey)}
    >
      <div className={styles.dateLabel}>
        <span>{item.label}</span>
        <span style={{fontSize:'0.65rem', opacity:0.8, fontWeight:500}}>{item.subLabel}</span>
      </div>
      <span className={styles.dateCount}>{item.count} leads</span>
    </div>
  );

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {isSuccess ? (
          <div className={styles.successWrapper}>
            <div className={styles.iconCircle}><Check size={40} strokeWidth={4} /></div>
            <h2 className={styles.successTitle}>Disparo Concluído!</h2>
            <p className={styles.successText}>Enviado para <b>{progress?.sent} contatos</b>.</p>
            <div className={styles.successActions}>
              <button className={styles.btnConfirm} onClick={onClose}>Fechar Janela</button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <h2 className={styles.title}>Painel de Disparos</h2>
            </div>

            <div className={styles.tabs}>
              <button className={`${styles.tabBtn} ${mode === 'bulk' ? styles.tabActive : ''}`} onClick={() => setMode('bulk')}><Users size={16} /> Disparo em Massa</button>
              <button className={`${styles.tabBtn} ${mode === 'manual' ? styles.tabActive : ''}`} onClick={() => setMode('manual')}><FlaskConical size={16} /> Teste Manual</button>
            </div>

            <div className={styles.body}>
              {mode === 'bulk' && (
                <>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{display:'flex', gap:12, alignItems:'center', width:'100%', justifyContent: 'space-between'}}>
                        <span className={styles.label} style={{marginBottom:0}}>Selecione os dias</span>
                        <button className={styles.selectAllBtn} onClick={handleSelectAll}>
                          {allSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}
                        </button>
                    </div>
                  </div>
                  
                  <label className={styles.checkboxWrapper} style={{fontSize:'0.8rem'}}>
                    <input type="checkbox" className={styles.checkbox} checked={skipReplicated} onChange={(e) => setSkipReplicated(e.target.checked)} />
                    <span>Ignorar se já atendeu (Call 1)</span>
                  </label>

                  <div className={styles.datesContainer}>
                    <div className={styles.topGrid}>
                      {topDays.map(day => <DateCard key={day.dateKey} item={day} />)}
                    </div>
                    <div className={styles.bottomGrid}>
                      {bottomDays.map(day => <DateCard key={day.dateKey} item={day} />)}
                    </div>
                  </div>

                  <div className={styles.webhookGroup}>
                    <span className={styles.label}>Selecione o Horário</span>
                    <div className={`${styles.radioOption} ${selectedWebhook === WEBHOOK_17H ? styles.selected : ''}`} onClick={() => setSelectedWebhook(WEBHOOK_17H)}>
                      <div style={{width:16, height:16, borderRadius:'50%', border:'4px solid', borderColor: selectedWebhook === WEBHOOK_17H ? 'var(--accent-color)' : '#ddd'}}></div>
                      Webhook 17 Horas
                    </div>
                    <div className={`${styles.radioOption} ${selectedWebhook === WEBHOOK_20H ? styles.selected : ''}`} onClick={() => setSelectedWebhook(WEBHOOK_20H)}>
                      <div style={{width:16, height:16, borderRadius:'50%', border:'4px solid', borderColor: selectedWebhook === WEBHOOK_20H ? 'var(--accent-color)' : '#ddd'}}></div>
                      Webhook 20 Horas
                    </div>
                  </div>
                </>
              )}

              {mode === 'manual' && (
                <div className={styles.manualInputContainer}>
                  <span className={styles.label}>Cole APENAS OS NÚMEROS</span>
                  <textarea className={styles.textarea} placeholder={`5511999999999`} value={manualText} onChange={(e) => setManualText(e.target.value)} />
                </div>
              )}

              <div className={styles.counterBox}>
                {isSending ? 
                  <span>Enviando... {progress?.sent} / {progress?.total}</span> : 
                  <span>{activeCount} contatos prontos para envio</span>
                }
              </div>

              <div className={styles.actions}>
                <button className={styles.btnCancel} onClick={onClose} disabled={isSending}>Cancelar</button>
                <button className={styles.btnConfirm} onClick={handleSend} disabled={isButtonDisabled}>
                  {isSending ? 'Disparando...' : <><PhoneOutgoing size={18} /> Confirmar Disparo</>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}