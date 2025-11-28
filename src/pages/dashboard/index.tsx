// src/pages/dashboard/index.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { supabase } from '@/lib/supabaseClient';
import { Lead } from '@/types/leads';
import { CallLead } from '@/types/callLeads';
// CORREÇÃO: O CSS está na mesma pasta, então o caminho é apenas ./
import styles from './page.module.css'; 

import LeadsTable from '@/components/LeadsTable';
import CallLeadsTable from '@/components/CallLeadsTable';
import LeadModal from '@/components/LeadModal';
import Navbar from '@/components/Navbar';
import DashboardOverview from '@/components/DashboardOverview';
import CallDashboardOverview from '@/components/CallDashboardOverview';
import TriggerCallModal from '@/components/TriggerCallModal';
import DateRangePicker, { DateFilterType } from '@/components/DateRangePicker'; 

import { startOfDay, endOfDay } from 'date-fns'; 
import { Wifi, WifiOff, PhoneOutgoing } from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [callLeads, setCallLeads] = useState<CallLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [currentTab, setCurrentTab] = useState<'leads' | 'call'>('leads');
  const [isConnected, setIsConnected] = useState(false);
  const [showTriggerModal, setShowTriggerModal] = useState(false);

  // --- FILTRO DE DATA PADRÃO (HOJE) ---
  const [chartDateFilter, setChartDateFilter] = useState<DateFilterType>({
    label: 'Hoje',
    value: 'today',
    from: startOfDay(new Date()), 
    to: endOfDay(new Date())      
  });

  // --- 1. AUTH CHECK ---
  useEffect(() => {
    const token = Cookies.get('santa_auth');
    if (token !== 'logado') router.push('/');
  }, [router]);

  // --- 2. FETCH DATA & REALTIME ---
  useEffect(() => {
    const token = Cookies.get('santa_auth');
    if (token !== 'logado') return;

    fetchLeads();
    fetchCallLeads();

    // Canal WPP Leads
    const channelLeads = supabase.channel('realtime-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'WPP-UNIVERSO_RP-LEADS' }, (payload) => handleRealtimeChange(payload, setLeads))
      .subscribe((status) => status === 'SUBSCRIBED' ? setIsConnected(true) : setIsConnected(false));

    // Canal Call Leads
    const channelCall = supabase.channel('realtime-call')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'CALL-UNIVESO-RP-LEADS' }, (payload) => handleRealtimeCallChange(payload))
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

  // --- FUNÇÕES DE BUSCA SEGURAS (TRY/CATCH) ---
  async function fetchLeads() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('WPP-UNIVERSO_RP-LEADS')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      if (data) setLeads(data);
    } catch (err) {
      console.error('Erro ao buscar leads WPP:', err);
    } finally {
      // Garante que o loading pare mesmo com erro
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
    } catch (err) {
      console.error('Erro ao buscar leads CALL:', err);
    }
  }

  return (
    <div className={styles.mainWrapper}>
      <Navbar currentTab={currentTab} onTabChange={setCurrentTab} />

      <div className={styles.container}>
        
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.title} style={{ color: 'var(--text-primary)' }}>
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

          <div className={styles.actions} style={{ gap: '1rem', alignItems: 'center' }}>
            
            {currentTab === 'call' && (
              <>
                <button 
                  onClick={() => setShowTriggerModal(true)}
                  style={{
                    backgroundColor: '#000', color: '#fff', border: 'none', padding: '10px 20px',
                    borderRadius: '99px', fontWeight: 700, fontSize: '0.8rem', display: 'flex',
                    alignItems: 'center', gap: '8px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                  }}
                >
                  <PhoneOutgoing size={16} /> Disparar Ligações
                </button>

                {/* DATE PICKER (Controla o gráfico e cards) */}
                <DateRangePicker 
                  currentFilter={chartDateFilter} 
                  onFilterChange={setChartDateFilter} 
                />
              </>
            )}
          </div>
        </div>

        <main className={styles.content}>
          {loading && leads.length === 0 ? (
            <div className={styles.loading} style={{ color: 'var(--text-secondary)' }}>
              Conectando ao banco de dados... 🛰️
            </div>
          ) : (
            <>
              {currentTab === 'leads' && (
                <>
                  <DashboardOverview leads={leads} />
                  <LeadsTable leads={leads} onSelectLead={setSelectedLead} />
                </>
              )}
              
              {currentTab === 'call' && (
                <>
                  {/* Dashboard: Recebe filtro dinâmico */}
                  <CallDashboardOverview 
                    data={callLeads} 
                    chartFilter={chartDateFilter} 
                    dateFilter="lifetime" 
                  />
                  
                  {/* Tabela: Sempre mostra tudo (Lifetime) */}
                  <CallLeadsTable 
                    data={callLeads} 
                    dateFilter="lifetime" 
                  />
                </>
              )}
            </>
          )}
        </main>

        {selectedLead && <LeadModal lead={selectedLead} onClose={() => setSelectedLead(null)} />}
        {showTriggerModal && <TriggerCallModal data={callLeads} onClose={() => setShowTriggerModal(false)} />}

      </div>
    </div>
  );
}