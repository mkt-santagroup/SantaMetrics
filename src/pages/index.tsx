import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { supabase } from '@/lib/supabaseClient';
import { Lead } from '@/types/leads';
import { CallLead } from '@/types/callLeads';
import styles from './dashboard/page.module.css'; // Mantenha o CSS do dashboard

// Componentes
import LeadsTable from '@/components/LeadsTable';
import CallLeadsTable from '@/components/CallLeadsTable';
import LeadModal from '@/components/LeadModal';
import Navbar from '@/components/Navbar';
import DashboardOverview from '@/components/DashboardOverview';
import CallDashboardOverview from '@/components/CallDashboardOverview';

// Utils
import { isSameDay, subDays, isAfter } from 'date-fns';
import { Wifi, WifiOff } from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  
  // --- ESTADOS DE DADOS ---
  const [leads, setLeads] = useState<Lead[]>([]);
  const [callLeads, setCallLeads] = useState<CallLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  // --- NAVEGAÇÃO E FILTROS ---
  // Mudei o padrão para 'leads', já que fundimos as telas
  const [currentTab, setCurrentTab] = useState<'leads' | 'call'>('leads');
  const [dateFilter, setDateFilter] = useState('7days'); 
  
  const [isConnected, setIsConnected] = useState(false);

  // 1. AUTH CHECK
  useEffect(() => {
    const token = Cookies.get('santa_auth');
    if (token !== 'logado') {
      router.push('/login');
    }
  }, [router]);

  // 2. FETCH DATA & REALTIME
  useEffect(() => {
    const token = Cookies.get('santa_auth');
    if (token !== 'logado') return;

    fetchLeads();
    fetchCallLeads();

    // Canal Leads
    const channelLeads = supabase
      .channel('realtime-leads')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'WPP-UNIVERSO_RP-LEADS' },
        (payload) => handleRealtimeChange(payload, setLeads)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setIsConnected(true);
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setIsConnected(false);
      });

    // Canal Call Center
    const channelCall = supabase
      .channel('realtime-call')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'CALL-UNIVESO-RP-LEADS' },
        (payload) => handleRealtimeCallChange(payload)
      )
      .subscribe();

    return () => { 
      supabase.removeChannel(channelLeads); 
      supabase.removeChannel(channelCall);
    };
  }, []);

  const handleRealtimeChange = (payload: any, setFn: React.Dispatch<React.SetStateAction<any[]>>) => {
    const newRecord = payload.new;
    const oldRecord = payload.old;
    if (payload.eventType === 'INSERT') setFn((prev) => [newRecord, ...prev]);
    else if (payload.eventType === 'UPDATE') setFn((prev) => prev.map((item) => (item.id === newRecord.id ? newRecord : item)));
    else if (payload.eventType === 'DELETE') setFn((prev) => prev.filter((item) => item.id !== oldRecord.id));
  };

  const handleRealtimeCallChange = (payload: any) => {
    const newRecord = payload.new as CallLead;
    const oldRecord = payload.old as CallLead;
    setCallLeads((prev) => {
      if (payload.eventType === 'INSERT') return [newRecord, ...prev];
      if (payload.eventType === 'UPDATE') return prev.map(item => item.ID === newRecord.ID ? newRecord : item);
      if (payload.eventType === 'DELETE') return prev.filter(item => item.ID !== oldRecord.ID);
      return prev;
    });
  };

  async function fetchLeads() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('WPP-UNIVERSO_RP-LEADS')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setLeads(data);
    } catch (error) {
      console.error('Erro ao buscar leads:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCallLeads() {
    try {
      const { data, error } = await supabase
        .from('CALL-UNIVESO-RP-LEADS')
        .select('*')
        .order('ID', { ascending: false }); 
      if (error) throw error;
      if (data) setCallLeads(data as CallLead[]);
    } catch (error) {
      console.error('Erro ao buscar call leads:', error);
    }
  }

  // Filtros
  const filteredLeads = useMemo(() => {
    const today = new Date();
    return leads.filter(lead => {
      const leadDate = new Date(lead.created_at);
      if (dateFilter === 'today') return isSameDay(leadDate, today);
      if (dateFilter === 'yesterday') return isSameDay(leadDate, subDays(today, 1));
      if (dateFilter === '7days') return isAfter(leadDate, subDays(today, 7));
      if (dateFilter === '30days') return isAfter(leadDate, subDays(today, 30));
      return true;
    });
  }, [leads, dateFilter]);

  const filterOptions = [
    { label: 'HOJE', value: 'today' },
    { label: 'ONTEM', value: 'yesterday' },
    { label: '7 DIAS', value: '7days' },
    { label: '30 DIAS', value: '30days' },
    { label: 'LIFETIME', value: 'lifetime' },
  ];

  return (
    <div className={styles.mainWrapper}>
      {/* Navbar recebe a nova tipagem */}
      <Navbar currentTab={currentTab} onTabChange={setCurrentTab} />

      <div className={styles.container}>
        
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.title} style={{ color: 'var(--text-primary)' }}>
              {/* Ajustei os títulos para refletir a tela atual */}
              {currentTab === 'leads' && 'Gerenciamento de Whatsapp'}
              {currentTab === 'call' && 'Gerenciamento de Ligações'}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '0.5rem' }}>
              <p className={styles.subtitle} style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Dados em tempo real
              </p>
              <div className={styles.liveBadge} style={{ 
                background: isConnected ? 'rgba(22, 163, 74, 0.15)' : 'rgba(220, 38, 38, 0.15)',
                color: isConnected ? '#22c55e' : '#ef4444',
                border: isConnected ? '1px solid rgba(22, 163, 74, 0.2)' : '1px solid rgba(220, 38, 38, 0.2)'
              }}>
                {isConnected ? <Wifi size={12} strokeWidth={3} /> : <WifiOff size={12} />}
                <span>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <div className={styles.filterGroup} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDateFilter(option.value)}
                  className={`${styles.filterBtn} ${dateFilter === option.value ? styles.filterBtnActive : ''}`}
                  style={{ 
                    color: dateFilter !== option.value ? 'var(--text-secondary)' : undefined,
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <main className={styles.content}>
          {loading && leads.length === 0 ? (
            <div className={styles.loading} style={{ color: 'var(--text-secondary)' }}>
              Conectando ao banco de dados... 🛰️
            </div>
          ) : (
            <>
              {/* --- ABA LEADS (Agora contém o Dashboard EM CIMA) --- */}
              {currentTab === 'leads' && (
                <>
                  {/* Dashboard Cards e Gráficos */}
                  <DashboardOverview leads={filteredLeads} />
                  
                  {/* Tabela de Leads logo abaixo */}
                  <LeadsTable leads={filteredLeads} onSelectLead={setSelectedLead} />
                </>
              )}
              
              {/* --- ABA CALL CENTER --- */}
              {currentTab === 'call' && (
                <>
                  <CallDashboardOverview 
                    data={callLeads} 
                    dateFilter={dateFilter} 
                  />
                  
                  <CallLeadsTable 
                    data={callLeads} 
                    dateFilter={dateFilter} 
                  />
                </>
              )}
            </>
          )}
        </main>

        {selectedLead && (
          <LeadModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
        )}
      </div>
    </div>
  );
}