import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Lead } from '@/types/leads';
import styles from './page.module.css';
import LeadsTable from './components/LeadsTable';
import LeadModal from './components/LeadModal';
import Navbar from './components/Navbar';
import DashboardOverview from './components/DashboardOverview';
import { isSameDay, subDays, isAfter } from 'date-fns';
import { Wifi, WifiOff } from 'lucide-react';

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  // Navegação
  const [currentTab, setCurrentTab] = useState<'overview' | 'leads'>('overview');
  
  // Filtros de Data
  const [dateFilter, setDateFilter] = useState('7days'); // Padrão 7 dias
  
  // Status Realtime
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // 1. Busca Inicial
    fetchLeads();

    // 2. Configura Realtime Subscription
    const channel = supabase
      .channel('realtime-leads')
      .on(
        'postgres_changes',
        {
          event: '*', // Escuta INSERT, UPDATE e DELETE
          schema: 'public',
          table: 'WPP-UNIVERSO_RP-LEADS', 
        },
        (payload) => {
          handleRealtimeChange(payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setIsConnected(true);
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setIsConnected(false);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Manipula o estado localmente quando o banco muda
  const handleRealtimeChange = (payload: any) => {
    const newLead = payload.new as Lead;
    const oldLead = payload.old as Lead;

    if (payload.eventType === 'INSERT') {
      setLeads((prev) => [newLead, ...prev]);
    } 
    else if (payload.eventType === 'UPDATE') {
      setLeads((prev) => 
        prev.map((lead) => (lead.id === newLead.id ? newLead : lead))
      );
    } 
    else if (payload.eventType === 'DELETE') {
      setLeads((prev) => prev.filter((lead) => lead.id !== oldLead.id));
    }
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

  // Lógica de Filtros
  const filteredLeads = useMemo(() => {
    const today = new Date();
    return leads.filter(lead => {
      const leadDate = new Date(lead.created_at);
      
      if (dateFilter === 'today') return isSameDay(leadDate, today);
      if (dateFilter === 'yesterday') return isSameDay(leadDate, subDays(today, 1));
      if (dateFilter === '7days') return isAfter(leadDate, subDays(today, 7));
      if (dateFilter === '30days') return isAfter(leadDate, subDays(today, 30));
      
      return true; // lifetime
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
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <Navbar currentTab={currentTab} onTabChange={setCurrentTab} />

      <div className={styles.container}>
        <div className={styles.pageHeader}>
          {/* TÍTULO E STATUS */}
          <div>
            <h1 className={styles.title}>
              {currentTab === 'overview' ? 'Visão Geral' : 'Gerenciamento de Leads'}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '0.5rem' }}>
              <p className={styles.subtitle} style={{ margin: 0 }}>
                Dados em tempo real
              </p>
              
              {/* Badge de Status LIVE */}
              <div className={styles.liveBadge} style={{ 
                background: isConnected ? '#dcfce7' : '#fee2e2',
                color: isConnected ? '#16a34a' : '#dc2626',
              }}>
                {isConnected ? <Wifi size={12} strokeWidth={3} /> : <WifiOff size={12} />}
                <span>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
              </div>
            </div>
          </div>

          {/* FILTROS (Sem botão de sync) */}
          <div className={styles.actions}>
            <div className={styles.filterGroup}>
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDateFilter(option.value)}
                  className={`${styles.filterBtn} ${dateFilter === option.value ? styles.filterBtnActive : ''}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        <main className={styles.content}>
          {loading && leads.length === 0 ? (
            <div className={styles.loading}>Conectando ao banco de dados... 🛰️</div>
          ) : (
            <>
              {currentTab === 'overview' && (
                <DashboardOverview leads={filteredLeads} />
              )}
              {currentTab === 'leads' && (
                <LeadsTable leads={filteredLeads} onSelectLead={setSelectedLead} />
              )}
            </>
          )}
        </main>

        {/* MODAL */}
        {selectedLead && (
          <LeadModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
        )}
      </div>
    </div>
  );
}