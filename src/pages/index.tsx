// src/pages/index.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { supabase } from '@/lib/supabaseClient';
import { Lead } from '@/types/leads';
import styles from './dashboard/page.module.css'; // Certifique-se que o caminho do CSS está correto

// Componentes
import LeadsTable from '@/components/LeadsTable';
import LeadModal from '@/components/LeadModal';
import Navbar from '@/components/Navbar';
import DashboardOverview from '@/components/DashboardOverview';
import ViewsDashboard from '@/components/ViewsDashboard';

// --- NOVO COMPONENTE DE CALL CENTER ---
import CallLeadsList from '@/components/CallCenter/CallLeadsList'; 

// Ícones e Utils
import { Wifi, WifiOff } from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  
  // Estados de Dados (WhatsApp)
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de Controle
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [currentTab, setCurrentTab] = useState<'leads' | 'call' | 'views'>('leads');
  const [isConnected, setIsConnected] = useState(false);

  // --- 1. AUTH CHECK ---
  useEffect(() => {
    const token = Cookies.get('santa_auth');
    if (token !== 'logado') router.push('/login');
  }, [router]);

  // --- 2. FETCH DATA & REALTIME (Apenas WhatsApp) ---
  useEffect(() => {
    const token = Cookies.get('santa_auth');
    if (token !== 'logado') return;

    fetchLeads();

    // Mantemos o realtime apenas para o WhatsApp por enquanto
    const channelLeads = supabase.channel('realtime-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'WPP-UNIVERSO_RP-LEADS' }, (payload) => handleRealtimeChange(payload, setLeads))
      .subscribe((status) => status === 'SUBSCRIBED' ? setIsConnected(true) : setIsConnected(false));

    return () => { 
      supabase.removeChannel(channelLeads); 
    };
  }, []);

  // Handler Realtime Genérico
  const handleRealtimeChange = (payload: any, setFn: React.Dispatch<React.SetStateAction<any[]>>) => {
    const newRecord = payload.new;
    const oldRecord = payload.old;
    if (payload.eventType === 'INSERT') setFn((prev) => [newRecord, ...prev]);
    else if (payload.eventType === 'UPDATE') setFn((prev) => prev.map((item) => (item.id === newRecord.id ? newRecord : item)));
    else if (payload.eventType === 'DELETE') setFn((prev) => prev.filter((item) => item.id !== oldRecord.id));
  };

  // Busca Inicial (WhatsApp)
  async function fetchLeads() {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('WPP-UNIVERSO_RP-LEADS').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setLeads(data);
    } catch (err) {
      console.error('Erro ao buscar leads WPP:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.mainWrapper}>
      <Navbar currentTab={currentTab} onTabChange={setCurrentTab} />

      <div className={styles.container}>
        
        {/* CABEÇALHO (Apenas para a aba WhatsApp) */}
        {/* A aba Call e Views agora gerenciam seus próprios títulos internamente */}
        {currentTab === 'leads' && (
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.title} style={{ color: 'var(--text-primary)' }}>
                Gerenciamento de Whatsapp
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
          </div>
        )}

        <main className={styles.content}>
          {/* Loading inicial apenas se estiver na aba leads e vazio */}
          {loading && leads.length === 0 && currentTab === 'leads' ? (
            <div className={styles.loading} style={{ color: 'var(--text-secondary)' }}>
              Conectando ao banco de dados... 🛰️
            </div>
          ) : (
            <>
              {/* ABA 1: WHATSAPP */}
              {currentTab === 'leads' && (
                <>
                  <DashboardOverview leads={leads} />
                  <LeadsTable leads={leads} onSelectLead={setSelectedLead} />
                </>
              )}
              
              {/* ABA 2: CALL CENTER (NOVA VERSÃO) */}
              {currentTab === 'call' && (
                <CallLeadsList />
              )}

              {/* ABA 3: VIEWS */}
              {currentTab === 'views' && (
                <ViewsDashboard />
              )}
            </>
          )}
        </main>

        {/* MODAIS GLOBAIS */}
        {selectedLead && <LeadModal lead={selectedLead} onClose={() => setSelectedLead(null)} />}

      </div>
    </div>
  );
}