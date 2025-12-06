import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { CallLeadD2 } from '@/types/callLeadsD2';
import { format, isSameDay, differenceInDays, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RefreshCw, Phone, DownloadCloud, CheckCircle, Clock, PhoneOutgoing, XCircle, Zap, Copy, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import TriggerCallModal from '@/components/TriggerCallModal';
import CallDashboardOverview from './CallDashboardOverview';
import { DateFilterType } from '@/components/DateRangePicker';

// --- FUNÇÕES AUXILIARES ---
const formatTimePlayed = (totalSeconds: number | null) => {
  if (totalSeconds === null || totalSeconds === undefined) return '-';
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
};

const fmtDate = (d: string | null) => d ? format(new Date(d), "dd/MM HH:mm", { locale: ptBR, timeZone: 'UTC' } as any) : '-';

const getStatusConfig = (lead: CallLeadD2) => {
  if (lead.is_recovered && lead.current_last_login) {
      const loginDate = new Date(lead.current_last_login);
      if (!lead.called_at) return { label: 'VOLTOU ANTES', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.2)', icon: Zap };
      const callDate = new Date(lead.called_at);
      if (loginDate.getTime() < callDate.getTime()) return { label: 'VOLTOU ANTES', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.2)', icon: Zap };
      if (isSameDay(loginDate, callDate)) return { label: 'RECUPERADO NO DIA', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)', border: 'rgba(22, 163, 74, 0.2)', icon: CheckCircle };
      return { label: 'RECUPERADO DEPOIS', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)', border: 'rgba(14, 165, 233, 0.2)', icon: CheckCircle };
  }
  if (lead.called_at) {
      const callDate = new Date(lead.called_at);
      const today = new Date();
      if (differenceInDays(today, callDate) > 7) return { label: 'NÃO RECUPERADO', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)', icon: XCircle };
      return { label: 'AGUARDANDO', color: '#ca8a04', bg: 'rgba(202, 138, 4, 0.1)', border: 'rgba(202, 138, 4, 0.2)', icon: Clock };
  }
  return { label: 'PENDENTE', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', border: 'rgba(107, 114, 128, 0.2)', icon: Clock };
};

export default function CallLeadsList() {
  const [leads, setLeads] = useState<CallLeadD2[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [callingId, setCallingId] = useState<number | null>(null);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  
  // Estado para indicar automação rodando (sem bloquear UI)
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  // --- PAGINAÇÃO ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // --- FILTRO ---
  const [dateFilter, setDateFilter] = useState<DateFilterType>({
    label: 'Últimos 7 dias',
    value: '7days',
    from: subDays(startOfDay(new Date()), 7),
    to: endOfDay(new Date())
  });

  async function fetchLeads() {
    setLoadingList(true);
    const { data } = await supabase
      .from('CALL_LEADS_D2')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setLeads(data);
    setLoadingList(false);
  }

  // --- AUTOMATIZAÇÃO (POLLING) ---
  useEffect(() => {
    // 1. Carrega inicial
    fetchLeads();
    
    // 2. Função unificada de sincronização
    const runAutomation = async () => {
        setIsAutoSyncing(true);
        console.log('🔄 [AUTO] Iniciando ciclo de atualização...');
        try {
            // Roda Ingestão (Silencioso)
            await handleIngest(true);
            // Roda Atualização (Silencioso)
            await handleUpdate(true);
            console.log('✅ [AUTO] Ciclo finalizado.');
        } catch (error) {
            console.error('❌ [AUTO] Erro no ciclo:', error);
        } finally {
            setIsAutoSyncing(false);
        }
    };

    // 3. Roda imediatamente ao montar (além do fetchLeads) para garantir dados frescos
    runAutomation();

    // 4. Configura intervalo de 10 minutos (600.000 ms)
    const intervalId = setInterval(runAutomation, 10 * 60 * 1000);

    // Limpa ao desmontar
    return () => clearInterval(intervalId);
  }, []);

  // --- LÓGICA DE FILTRAGEM ---
  const filteredLeads = useMemo(() => {
    if (dateFilter.value === 'lifetime') return leads;
    if (!dateFilter.from || !dateFilter.to) return leads;

    return leads.filter(lead => {
        if (!lead.created_at) return false;
        const leadDate = new Date(lead.created_at);
        return isWithinInterval(leadDate, { start: dateFilter.from!, end: dateFilter.to! });
    });
  }, [leads, dateFilter]);

  // --- LÓGICA DE PAGINAÇÃO ---
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const currentLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLeads.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLeads, currentPage, itemsPerPage]);

  useEffect(() => { setCurrentPage(1); }, [dateFilter, itemsPerPage]);

  // --- ACTIONS (AGORA COM MODO SILENCIOSO) ---
  const handleIngest = async (silent = false) => {
    try {
      const res = await fetch('/api/leads/sync-d2', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ingest' }) });
      const json = await res.json();
      if (res.ok) { 
          if(!silent && json.novos > 0) alert(`Sucesso! ${json.novos} novos leads.`);
          if(json.novos > 0) fetchLeads(); // Só recarrega se tiver novidade
      } else { 
          if(!silent) alert('Erro: ' + json.error); 
      }
    } catch (err) { if(!silent) alert('Erro de conexão.'); }
  };

  const handleUpdate = async (silent = false) => {
    try {
      const res = await fetch('/api/leads/sync-d2', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update' }) });
      const json = await res.json();
      if (res.ok) { 
          if(!silent && json.recuperados > 0) alert(`Verificado! ${json.recuperados} recuperados.`);
          if(json.recuperados > 0) fetchLeads(); // Só recarrega se tiver mudança
      } else { 
          if(!silent) alert('Erro: ' + json.error); 
      }
    } catch (err) { if(!silent) alert('Erro de conexão.'); }
  };

  const handleCall = async (lead: CallLeadD2) => {
    if (!lead.whatsapp) return alert('Lead sem número.');
    if(!confirm(`Ligar para ${lead.name}? (SMS Padrão será enviado)`)) return;
    setCallingId(lead.id);
    try {
        const res = await fetch('/api/calls/process-call', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead_id: lead.id, phone: lead.whatsapp, name: lead.name, send_sms: true, sms_content: "Chegou a quinta do GTA RP! Cola aqui com a gente na Cidade Universo!" })
        });
        const data = await res.json();
        if (res.ok) { alert(`✅ Chamada #${data.count} realizada!`); fetchLeads(); } else { throw new Error(data.error); }
    } catch (error: any) { alert(`Erro: ${error.message}`); } finally { setCallingId(null); }
  };

  const handleCopyIds = () => {
    if (filteredLeads.length === 0) return alert('Nenhum lead filtrado.');
    const passports = filteredLeads.map(l => l.passport).join(', '); 
    const sql = `WHERE passport IN ( ${passports} )`;
    navigator.clipboard.writeText(sql).then(() => {
        alert(`✅ ${filteredLeads.length} Passports copiados!`);
    }).catch(() => alert('Erro ao copiar.'));
  };

  // --- BOTÕES INJETADOS (LIMPOS - SEM BUSCAR/ATUALIZAR) ---
  const ActionButtons = (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      
      {/* Indicador de Automação */}
      {isAutoSyncing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 10, color: 'var(--text-secondary)', fontSize: '0.75rem', animation: 'fadeIn 0.3s' }}>
            <Loader2 size={14} className="spin" />
            <span>Sincronizando...</span>
        </div>
      )}

      <button onClick={() => setShowTriggerModal(true)} style={{ background: '#000', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
        <PhoneOutgoing size={16} /> Disparar
      </button>
      
      <button onClick={handleCopyIds} style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '10px 16px', borderRadius: '12px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
        <Copy size={16} /> SQL
      </button>
    </div>
  );

  return (
    <div style={{ marginTop: '2rem', fontFamily: 'Montserrat, sans-serif' }}>
      
      <CallDashboardOverview 
        leads={leads} 
        dateFilter={dateFilter}
        onFilterChange={setDateFilter}
        actions={ActionButtons} 
      />

      <div style={{ background: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 10px 30px -10px var(--shadow-color)', marginTop: '2rem' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Listagem de Leads</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total: {filteredLeads.length} leads</span>
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <tr>
              <th style={{ padding: '1.2rem', textAlign: 'left' }}>Passport</th>
              <th style={{ padding: '1.2rem', textAlign: 'left' }}>Nome / Whatsapp</th>
              <th style={{ padding: '1.2rem', textAlign: 'left' }}>Último Login</th>
              <th style={{ padding: '1.2rem', textAlign: 'center' }}>Tentativas</th>
              <th style={{ padding: '1.2rem', textAlign: 'center' }}>Retorno</th>
              <th style={{ padding: '1.2rem', textAlign: 'center' }}>Tempo Jogo</th>
              <th style={{ padding: '1.2rem', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '1.2rem', textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loadingList && leads.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '4rem', textAlign: 'center' }}><RefreshCw size={24} className="spin" /></td></tr>
            ) : filteredLeads.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum lead encontrado neste período.</td></tr>
            ) : (
              currentLeads.map(lead => {
                const statusConfig = getStatusConfig(lead);
                const StatusIcon = statusConfig.icon;
                return (
                  <tr key={lead.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>#{lead.passport}</td>
                    <td style={{ padding: '1.2rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{lead.name || 'Desconhecido'}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={12}/> {lead.whatsapp || '-'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1.2rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{fmtDate(lead.last_login_at_ingestion)}</td>
                    <td style={{ padding: '1.2rem', textAlign: 'center', fontWeight: 800 }}>{(lead as any).call_count || 0}</td>
                    <td style={{ padding: '1.2rem', textAlign: 'center' }}>
                      {lead.current_last_login ? <span style={{ color: '#10b981', fontWeight: 600, fontSize:'0.85rem' }}>{fmtDate(lead.current_last_login)}</span> : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>-</span>}
                    </td>
                    <td style={{ padding: '1.2rem', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 600 }}>{formatTimePlayed(lead.time_played)}</td>
                    <td style={{ padding: '1.2rem', textAlign: 'center' }}>
                      <span style={{ padding: '6px 12px', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', backgroundColor: statusConfig.bg, color: statusConfig.color, border: `1px solid ${statusConfig.border}`, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace:'nowrap' }}>
                        <StatusIcon size={12} /> {statusConfig.label}
                      </span>
                    </td>
                    <td style={{ padding: '1.2rem', textAlign: 'center' }}>
                      <button onClick={() => handleCall(lead)} disabled={callingId === lead.id} style={{ background: callingId === lead.id ? 'var(--bg-hover)' : 'var(--text-primary)', color: callingId === lead.id ? 'var(--text-secondary)' : 'var(--bg-card)', border: 'none', width: '36px', height: '36px', borderRadius: '10px', cursor: callingId === lead.id ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: callingId === lead.id ? 'none' : '0 4px 10px rgba(0,0,0,0.1)' }}>
                          {callingId === lead.id ? <RefreshCw size={16} className="spin" /> : <PhoneOutgoing size={16} />}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* --- RODAPÉ COM PAGINAÇÃO --- */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display:'flex', alignItems:'center', gap: 10 }}>
                <span>Itens por página:</span>
                <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }}>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                </select>
                <span style={{marginLeft: 10}}>Página {currentPage} de {totalPages}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-hover)', color: 'var(--text-primary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>
                    <ChevronLeft size={16} />
                </button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-hover)', color: 'var(--text-primary)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}>
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>

      </div>
      
      {showTriggerModal && <TriggerCallModal data={filteredLeads.map(l => ({ ...l, ID: l.id } as any))} onClose={() => setShowTriggerModal(false)} />}
      <style jsx>{` .spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } } `}</style>
    </div>
  );
}