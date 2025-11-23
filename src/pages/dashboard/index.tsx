import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router'; // <--- Para redirecionamento
import Cookies from 'js-cookie';         // <--- Para checar o login
import { supabase } from '@/lib/supabaseClient';
import { Lead } from '@/types/leads';
import styles from './page.module.css';
import LeadsTable from '@/components/LeadsTable';
import LeadModal from '@/components/LeadModal';
import Navbar from '@/components/Navbar';
import DashboardOverview from '@/components/DashboardOverview';
import { isSameDay, subDays, isAfter } from 'date-fns';
import { Wifi, WifiOff } from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  // Navegação e Filtros
  const [currentTab, setCurrentTab] = useState<'overview' | 'leads'>('overview');
  const [dateFilter, setDateFilter] = useState('7days'); 
  
  // Status Realtime
  const [isConnected, setIsConnected] = useState(false);

  // 1. VERIFICAÇÃO DE SEGURANÇA (Proteção de Rota)
  useEffect(() => {
    const token = Cookies.get('santa_auth');
    // Se não tiver o cookie ou o valor estiver errado, chuta pro login
    if (token !== 'logado') {
      router.push('/');
    }
  }, [router]);

  // 2. Busca de Dados e Realtime
  useEffect(() => {
    // Só busca se estiver logado (para evitar chamada desnecessária enquanto redireciona)
    const token = Cookies.get('santa_auth');
    if (token !== 'logado') return;

    fetchLeads();

    const channel = supabase
      .channel('realtime-leads')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'WPP-UNIVERSO_RP-LEADS' },
        (payload) => { handleRealtimeChange(payload); }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setIsConnected(true);
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setIsConnected(false);
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleRealtimeChange = (payload: any) => {
    const newLead = payload.new as Lead;
    const oldLead = payload.old as Lead;

    if (payload.eventType === 'INSERT') {
      setLeads((prev) => [newLead, ...prev]);
    } 
    else if (payload.eventType === 'UPDATE') {
      setLeads((prev) => prev.map((lead) => (lead.id === newLead.id ? newLead : lead)));
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
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <Navbar currentTab={currentTab} onTabChange={setCurrentTab} />

      <div className={styles.container}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.title}>
              {currentTab === 'overview' ? 'Visão Geral' : 'Gerenciamento de Leads'}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '0.5rem' }}>
              <p className={styles.subtitle} style={{ margin: 0 }}>
                Dados em tempo real
              </p>
              <div className={styles.liveBadge} style={{ 
                background: isConnected ? '#dcfce7' : '#fee2e2',
                color: isConnected ? '#16a34a' : '#dc2626',
              }}>
                {isConnected ? <Wifi size={12} strokeWidth={3} /> : <WifiOff size={12} />}
                <span>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
              </div>
            </div>
          </div>

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

        <main className={styles.content}>
          {loading && leads.length === 0 ? (
            <div className={styles.loading}>Conectando ao banco de dados... 🛰️</div>
          ) : (
            <>
              {currentTab === 'overview' && <DashboardOverview leads={filteredLeads} />}
              {currentTab === 'leads' && <LeadsTable leads={filteredLeads} onSelectLead={setSelectedLead} />}
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