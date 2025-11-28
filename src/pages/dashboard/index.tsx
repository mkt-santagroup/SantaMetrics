import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { supabase } from '@/lib/supabaseClient';
import { Lead } from '@/types/leads';
import { CallLead } from '@/types/callLeads';
import styles from './page.module.css'; 

import LeadsTable from '@/components/LeadsTable';
import CallLeadsTable from '@/components/CallLeadsTable';
import LeadModal from '@/components/LeadModal';
import Navbar from '@/components/Navbar';
import DashboardOverview from '@/components/DashboardOverview';
import CallDashboardOverview from '@/components/CallDashboardOverview';
import TriggerCallModal from '@/components/TriggerCallModal';
import DateRangePicker, { DateFilterType } from '@/components/DateRangePicker'; 

import { startOfDay, endOfDay } from 'date-fns'; // <--- IMPORTANTE: endOfDay
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

  // --- AQUI ESTÁ A DEFINIÇÃO PADRÃO ---
  // Certifique-se que está EXATAMENTE assim:
  const [chartDateFilter, setChartDateFilter] = useState<DateFilterType>({
    label: 'Hoje',
    value: 'today',
    from: startOfDay(new Date()), // Início de hoje (00:00)
    to: endOfDay(new Date())      // Fim de hoje (23:59) -> IMPORTANTE USAR endOfDay
  });

  // ... (RESTO DO CÓDIGO PERMANECE IGUAL) ...
  // ... useEffects de Auth e Fetch ...
  
  // Apenas copiando o return para garantir que não falta nada
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
                  <CallDashboardOverview 
                    data={callLeads} 
                    chartFilter={chartDateFilter} 
                    dateFilter="lifetime" 
                  />
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