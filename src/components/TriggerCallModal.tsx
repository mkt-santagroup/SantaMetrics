import { useState, useMemo } from 'react';
import styles from './TriggerCallModal.module.css';
import { format, subDays, startOfDay, isSameDay } from 'date-fns'; 
import { ptBR } from 'date-fns/locale';
import { PhoneOutgoing, Check, Users, FlaskConical, MessageSquare } from 'lucide-react';

interface TriggerCallModalProps {
  data: any[]; 
  onClose: () => void;
}

export default function TriggerCallModal({ data, onClose }: TriggerCallModalProps) {
  const [mode, setMode] = useState<'bulk' | 'manual'>('bulk');
  const [skipAnswered, setSkipAnswered] = useState(true); 
  
  // --- NOVOS ESTADOS DO SMS ---
  const [sendSms, setSendSms] = useState(true);
  const [smsContent, setSmsContent] = useState(`Chegou a quinta do GTA RP, e aqui na Cidade Universo a galera te espera! Cola aqui com a gente!\n\nhttps://discord.gg/universorp\n\nNo FiveM basta apertar F8 e digitar: connect universo.santagroup.gg\n\nPartiu fechar a semana jogando?!`);

  const [selectedDates, setSelectedDates] = useState<string[]>([
    format(new Date(), 'yyyy-MM-dd')
  ]);

  const [manualText, setManualText] = useState(''); 
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [progress, setProgress] = useState<{ sent: number, total: number } | null>(null);

  // --- BOTÃO DE TESTE (Com SMS Opcional) ---
  const handleTestMyNumber = async () => {
    if(!confirm("Disparar teste para 22998151575?")) return;
    
    setIsSending(true);
    try {
        fetch('/api/calls/process-call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lead_id: 999999,
                phone: '5522998151575',
                name: 'Teste Admin',
                send_sms: sendSms,        // <--- Manda config
                sms_content: smsContent   // <--- Manda texto
            })
        });
        
        alert("Teste disparado! Aguarde a ligação.");

    } catch (err) {
        alert("Erro ao testar.");
    } finally {
        setIsSending(false);
    }
  };

  const last7DaysData = useMemo(() => {
    const today = startOfDay(new Date());
    const daysMap = new Map<string, { label: string, subLabel?: string, count: number, dateKey: string }>();

    for (let i = 0; i < 7; i++) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      let label = format(d, "EEE", { locale: ptBR }).toUpperCase(); 
      let subLabel = format(d, "dd/MM");
      if (isSameDay(d, today)) { label = "HOJE"; subLabel = format(d, "dd/MM"); }
      else if (isSameDay(d, subDays(today, 1))) { label = "ONTEM"; subLabel = format(d, "dd/MM"); }
      daysMap.set(key, { label, subLabel, count: 0, dateKey: key });
    }

    data.forEach(lead => {
      if (!lead.created_at) return;
      const dateKey = lead.created_at.substring(0, 10);
      if (daysMap.has(dateKey)) {
        daysMap.get(dateKey)!.count++;
      }
    });

    return Array.from(daysMap.values());
  }, [data]); 

  const topDays = last7DaysData.slice(0, 2);
  const bottomDays = last7DaysData.slice(2);

  const allSelected = last7DaysData.every(d => selectedDates.includes(d.dateKey));
  
  const handleSelectAll = () => {
    if (allSelected) setSelectedDates([]);
    else setSelectedDates(last7DaysData.map(d => d.dateKey));
  };

  const toggleDate = (dateKey: string) => {
    setSelectedDates(prev => prev.includes(dateKey) ? prev.filter(d => d !== dateKey) : [...prev, dateKey]);
  };

  const leadsParaEnviar = useMemo(() => {
    const selectedSet = new Set(selectedDates);
    return data.filter(lead => {
      if (!lead.created_at) return false;
      const dateKey = lead.created_at.substring(0, 10);
      if (!selectedSet.has(dateKey)) return false;
      if (skipAnswered) {
          const history = lead.call_history || [];
          const jaAtendeu = Array.isArray(history) && history.some((call: any) => 
              call.status && call.status.toLowerCase().includes('answered')
          );
          if (jaAtendeu) return false;
      }
      return true;
    });
  }, [data, selectedDates, skipAnswered]);

  const manualLeads = useMemo(() => {
    if (!manualText.trim()) return [];
    return manualText.split('\n')
      .map(l => { const n = l.trim(); return n ? { id: 0, whatsapp: n, name: 'Manual' } : null; })
      .filter((l): l is { id: number, whatsapp: string, name: string } => l !== null);
  }, [manualText]);

  // --- DISPARO EM MASSA ---
  const handleSend = async () => {
    const listToSend = mode === 'bulk' ? leadsParaEnviar : manualLeads;

    if (listToSend.length === 0) return;
    if(!confirm(`Iniciar disparo para ${listToSend.length} contatos?`)) return;

    setIsSending(true);
    let sentCount = 0;
    
    for (const item of listToSend) {
      fetch('/api/calls/process-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            lead_id: item.id || (item as any).ID, 
            phone: item.whatsapp,
            name: item.name || 'Desconhecido',
            send_sms: sendSms,      // <--- Manda config
            sms_content: smsContent // <--- Manda texto
        })
      }).catch(e => console.error("Falha individual", e));

      sentCount++;
      setProgress({ sent: sentCount, total: listToSend.length });
      await new Promise(r => setTimeout(r, 200)); 
    }

    setIsSending(false);
    setIsSuccess(true);
  };

  const activeCount = mode === 'bulk' ? leadsParaEnviar.length : manualLeads.length;
  const isButtonDisabled = isSending || activeCount === 0;

  const DateCard = ({ item }: { item: typeof last7DaysData[0] }) => (
    <div 
      className={`${styles.dateItem} ${selectedDates.includes(item.dateKey) ? styles.dateItemActive : ''}`}
      onClick={() => toggleDate(item.dateKey)}
    >
      <div className={styles.dateLabel}>
        <span>{item.label}</span>
        <span style={{fontSize:'0.65rem', opacity:0.8, fontWeight:500}}>{item.subLabel}</span>
      </div>
      <span className={styles.dateCount}>{item.count}</span>
    </div>
  );

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {isSuccess ? (
          <div className={styles.successWrapper}>
            <div className={styles.iconCircle}><Check size={40} strokeWidth={4} /></div>
            <h2 className={styles.successTitle}>Disparos Iniciados!</h2>
            <p className={styles.successText}>O sistema está processando <b>{progress?.sent} chamadas</b> em background.</p>
            <div className={styles.successActions}>
              <button className={styles.btnConfirm} onClick={onClose}>Fechar Janela</button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.header} style={{position:'relative'}}>
              <h2 className={styles.title}>Painel de Disparos</h2>
              <button onClick={handleTestMyNumber} style={{position:'absolute', top: 0, right: 0, fontSize:'0.7rem', background:'transparent', border:'1px solid var(--border-color)', color:'var(--text-secondary)', padding:'4px 8px', borderRadius:'6px', cursor:'pointer'}}>TESTAR (22...575)</button>
            </div>

            <div className={styles.tabs}>
              <button className={`${styles.tabBtn} ${mode === 'bulk' ? styles.tabActive : ''}`} onClick={() => setMode('bulk')}><Users size={16} /> Disparo em Massa</button>
              <button className={`${styles.tabBtn} ${mode === 'manual' ? styles.tabActive : ''}`} onClick={() => setMode('manual')}><FlaskConical size={16} /> Teste Manual</button>
            </div>

            <div className={styles.body}>
              
              {/* CONFIGURAÇÃO DE SMS (COMUM PARA AMBOS OS MODOS) */}
              <div style={{background:'var(--bg-hover)', padding:'1rem', borderRadius:'12px', marginBottom:'1rem', border:'1px solid var(--border-color)'}}>
                <label className={styles.checkboxWrapper} style={{marginBottom: sendSms ? '0.8rem' : 0}}>
                    <input type="checkbox" className={styles.checkbox} checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} />
                    <span style={{fontWeight:700, display:'flex', alignItems:'center', gap:6}}><MessageSquare size={14}/> Enviar SMS após a ligação?</span>
                </label>
                
                {sendSms && (
                    <div style={{animation:'fadeIn 0.3s'}}>
                        <span className={styles.label} style={{marginBottom:4}}>Conteúdo da Mensagem</span>
                        <textarea 
                            className={styles.textarea} 
                            style={{height:'80px', fontSize:'0.8rem'}}
                            value={smsContent}
                            onChange={(e) => setSmsContent(e.target.value)}
                        />
                    </div>
                )}
              </div>

              {mode === 'bulk' && (
                <>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{display:'flex', gap:12, alignItems:'center', width:'100%', justifyContent: 'space-between'}}>
                        <span className={styles.label} style={{marginBottom:0}}>Selecione os dias</span>
                        <button className={styles.selectAllBtn} onClick={handleSelectAll}>{allSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}</button>
                    </div>
                  </div>
                  
                  <label className={styles.checkboxWrapper} style={{fontSize:'0.8rem'}}>
                    <input type="checkbox" className={styles.checkbox} checked={skipAnswered} onChange={(e) => setSkipAnswered(e.target.checked)} />
                    <span>Ignorar se já atendeu (Status: ANSWERED)</span>
                  </label>

                  <div className={styles.datesContainer}>
                    <div className={styles.topGrid}>{topDays.map(day => <DateCard key={day.dateKey} item={day} />)}</div>
                    <div className={styles.bottomGrid}>{bottomDays.map(day => <DateCard key={day.dateKey} item={day} />)}</div>
                  </div>
                </>
              )}

              {mode === 'manual' && (
                <div className={styles.manualInputContainer}>
                  <span className={styles.label}>Cole APENAS OS NÚMEROS</span>
                  <textarea className={styles.textarea} placeholder={`5511999999999\n5521988888888`} value={manualText} onChange={(e) => setManualText(e.target.value)} />
                </div>
              )}

              <div className={styles.counterBox}>
                {isSending ? <span>Enviando... {progress?.sent} / {progress?.total}</span> : <span>{activeCount} contatos prontos</span>}
              </div>

              <div className={styles.actions}>
                <button className={styles.btnCancel} onClick={onClose} disabled={isSending}>Cancelar</button>
                <button className={styles.btnConfirm} onClick={handleSend} disabled={isButtonDisabled}>{isSending ? 'Processando...' : <><PhoneOutgoing size={18} /> Confirmar Disparo</>}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}