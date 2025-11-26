import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { supabase } from '@/lib/supabaseClient';
import { Lead } from '@/types/leads';
import { CallLead } from '@/types/callLeads';
import styles from './page.module.css';

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
  
  // --- ESTADOS DE NAVEGAÇÃO E FILTROS ---
  const [currentTab, setCurrentTab] = useState<'overview' | 'leads' | 'call'>('overview');
  const [dateFilter, setDateFilter] = useState('7days'); 
  
  // --- ESTADO DE CONEXÃO ---
  const [isConnected, setIsConnected] = useState(false);

  // 1. VERIFICAÇÃO DE SEGURANÇA (Auth)
  useEffect(() => {
    const token = Cookies.get('santa_auth');
    if (token !== 'logado') {
      router.push('/');
    }
  }, [router]);

  // 2. BUSCA DE DADOS E REALTIME
  useEffect(() => {
    const token = Cookies.get('santa_auth');
    if (token !== 'logado') return;

    // Carrega dados iniciais
    fetchLeads();
    fetchCallLeads();

    // Canal 1: Tabela de Leads (WhatsApp/Funil)
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

    // Canal 2: Tabela de Call Center (Engajamento)
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

  // --- HANDLERS DE REALTIME ---

  // Genérico para WPP-LEADS (usa campo 'id')
  const handleRealtimeChange = (payload: any, setFn: React.Dispatch<React.SetStateAction<any[]>>) => {
    const newRecord = payload.new;
    const oldRecord = payload.old;

    if (payload.eventType === 'INSERT') {
      setFn((prev) => [newRecord, ...prev]);
    } 
    else if (payload.eventType === 'UPDATE') {
      setFn((prev) => prev.map((item) => (item.id === newRecord.id ? newRecord : item)));
    } 
    else if (payload.eventType === 'DELETE') {
      setFn((prev) => prev.filter((item) => item.id !== oldRecord.id));
    }
  };

  // Específico para CALL-LEADS (usa campo 'ID' maiúsculo)
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

  // --- FUNÇÕES DE BUSCA ---

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

  // --- LÓGICA DE FILTROS (DATA - Para Dashboard Geral) ---
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

  // Opções dos botões de filtro
  const filterOptions = [
    { label: 'HOJE', value: 'today' },
    { label: 'ONTEM', value: 'yesterday' },
    { label: '7 DIAS', value: '7days' },
    { label: '30 DIAS', value: '30days' },
    { label: 'LIFETIME', value: 'lifetime' },
  ];

  return (
    <div className={styles.mainWrapper}>
      <Navbar currentTab={currentTab} onTabChange={setCurrentTab} />

      <div className={styles.container}>
        
        {/* --- CABEÇALHO DA PÁGINA --- */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.title} style={{ color: 'var(--text-primary)' }}>
              {currentTab === 'overview' && 'Visão Geral'}
              {currentTab === 'leads' && 'Gerenciamento de Leads'}
              {currentTab === 'call' && 'Call Center & Engajamento'}
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

          {/* FILTROS DE DATA (Visíveis em todas as abas) */}
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

        {/* --- CONTEÚDO PRINCIPAL --- */}
        <main className={styles.content}>
          {loading && leads.length === 0 ? (
            <div className={styles.loading} style={{ color: 'var(--text-secondary)' }}>
              Conectando ao banco de dados... 🛰️
            </div>
          ) : (
            <>
              {/* ABA 1: DASHBOARD GERAL */}
              {currentTab === 'overview' && (
                <DashboardOverview leads={filteredLeads} />
              )}

              {/* ABA 2: TABELA DE LEADS (WPP) */}
              {currentTab === 'leads' && (
                <LeadsTable leads={filteredLeads} onSelectLead={setSelectedLead} />
              )}
              
              {/* ABA 3: CALL CENTER (DASHBOARD + TABELA) */}
              {currentTab === 'call' && (
                <>
                  {/* CORREÇÃO: Passando o filtro de data para os dois componentes */}
                  <CallDashboardOverview 
                    data={callLeads} 
                    dateFilter={dateFilter} 
                  />
                  
                  {/* AQUI ESTAVA O ERRO NO SEU BUILD: Agora tem dateFilter */}
                  <CallLeadsTable 
                    data={callLeads} 
                    dateFilter={dateFilter} 
                  />
                </>
              )}
            </>
          )}
        </main>

        {/* --- MODAL DE DETALHES (Apenas para leads WPP) --- */}
        {selectedLead && (
          <LeadModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
        )}
      </div>
    </div>
  );
}