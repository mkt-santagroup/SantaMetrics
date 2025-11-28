import { useState, useMemo } from 'react';
import { CallLead } from '@/types/callLeads';
import styles from './CallDashboardOverview.module.css';
import SmartChart from './SmartChart';
import DateRangePicker, { DateFilterType } from './DateRangePicker';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  parseISO, startOfDay, endOfDay, isWithinInterval, format 
} from 'date-fns';
import { useTheme } from '@/context/ThemeContext';
import { PhoneOutgoing, Phone, PhoneMissed } from 'lucide-react';

interface CallDashboardOverviewProps {
  data: CallLead[];
  chartFilter: DateFilterType; 
  dateFilter: string; 
}

// Mapeamento 1:1 com o Banco de Dados
const STATUS_MAP: Record<string, { label: string, color: string }> = {
  'ANSWERED': { label: 'Atendida', color: '#10b981' }, 
  'NO ANSWER': { label: 'Sem Resposta', color: '#eab308' }, 
  'BUSY': { label: 'Ocupado', color: '#f97316' }, 
  'FAILED': { label: 'Falhou', color: '#ef4444' }, 
  'CONGESTION': { label: 'Congestionado', color: '#dc2626' }, 
  'NO_ROUTE': { label: 'Sem Rota', color: '#6b7280' }, 
  'ROUTE_UNAVAILABLE': { label: 'Rota Indisp.', color: '#4b5563' }, 
  'DUPLICATED': { label: 'Duplicado', color: '#374151' }, 
  'SENT': { label: 'Enviada (Sem Status)', color: '#52525b' }, // Cinza neutro
  'UNKNOWN': { label: 'Desconhecido', color: '#1f2937' }
};

export default function CallDashboardOverview({ data, chartFilter }: CallDashboardOverviewProps) {
  const { theme } = useTheme();

  // Estado para alternar entre Call 1 e Call 2
  const [activeTab, setActiveTab] = useState<'call1' | 'call2'>('call1');

  const [bottomFilter, setBottomFilter] = useState<DateFilterType>({
    label: 'Todo o Período',
    value: 'lifetime'
  });

  const axisColor = theme === 'dark' ? '#9ca3af' : '#888';
  const gridColor = theme === 'dark' ? '#333' : '#f0f0f0';
  
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#171717' : '#fff',
    border: theme === 'dark' ? '1px solid #333' : '1px solid #ddd',
    borderRadius: '12px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    color: theme === 'dark' ? '#fff' : '#000'
  };

  // --- FILTRO DE DATA ---
  const filteredData = useMemo(() => {
    if (bottomFilter.value === 'lifetime') return data;
    if (!bottomFilter.from || !bottomFilter.to) return data;

    const start = startOfDay(bottomFilter.from);
    const end = endOfDay(bottomFilter.to);

    return data.filter(item => {
      if (!item.created_at) return false;
      const itemDate = parseISO(item.created_at);
      return isWithinInterval(itemDate, { start, end });
    });
  }, [data, bottomFilter]);

  // --- PREPARAÇÃO DO GRÁFICO (BASEADO NA ABA ATIVA) ---
  const chartData = useMemo(() => {
    const dailyCounts: Record<string, any> = {};

    filteredData.forEach(item => {
      // 1. Define qual coluna olhar baseado na aba
      const callHour = activeTab === 'call1' ? item.call1_hour : item.call2_hour;
      const callStatus = activeTab === 'call1' ? item.call1_status : item.call2_status;

      // 2. Só processa se tiver data de disparo (prova que tentou ligar)
      if (callHour) {
        const dateKey = format(parseISO(callHour), 'dd/MM');
        
        if (!dailyCounts[dateKey]) dailyCounts[dateKey] = { name: dateKey };

        // 3. Normaliza o Status
        // Se status vier do banco, usa. Se vier NULL/Vazio, marca como SENT.
        let finalStatus = callStatus ? callStatus.trim() : 'SENT';
        
        // Garante que existe no mapa (Fallback para texto puro se não achar)
        const config = STATUS_MAP[finalStatus] || STATUS_MAP[finalStatus.toUpperCase()] || { label: finalStatus, color: '#888' };
        
        // 4. Incrementa
        dailyCounts[dateKey][config.label] = (dailyCounts[dateKey][config.label] || 0) + 1;
      }
    });

    return Object.values(dailyCounts).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredData, activeTab]);

  // --- CHAVES ATIVAS (Para gerar as áreas do gráfico) ---
  const activeKeys = useMemo(() => {
    const keys = new Set<string>();
    chartData.forEach(day => {
      Object.keys(day).forEach(k => {
        if (k !== 'name') keys.add(k);
      });
    });
    return Array.from(keys);
  }, [chartData]);

  // Total de chamadas NA VISÃO ATUAL (Só Call 1 ou Só Call 2)
  const totalCallsInView = chartData.reduce((acc, day) => {
    let dayTotal = 0;
    Object.keys(day).forEach(k => {
      if (k !== 'name') dayTotal += (day[k] as number);
    });
    return acc + dayTotal;
  }, 0);

  return (
    <div className={styles.container}>
      
      {/* Gráfico Geral (Topo) */}
      <SmartChart data={data} dateFilter={chartFilter} />

      <div className={styles.sectionHeader}>
        <div className={styles.leftControls}>
          <h3 className={styles.sectionTitle}>Análise Técnica</h3>
          
          {/* BOTÕES DE ALTERNÂNCIA (TOGGLE) */}
          <div className={styles.toggleGroup}>
            <button 
              className={`${styles.toggleBtn} ${activeTab === 'call1' ? styles.activeToggle : ''}`}
              onClick={() => setActiveTab('call1')}
            >
              1ª Ligação
            </button>
            <button 
              className={`${styles.toggleBtn} ${activeTab === 'call2' ? styles.activeToggle : ''}`}
              onClick={() => setActiveTab('call2')}
            >
              2ª Ligação
            </button>
          </div>
        </div>
        
        <DateRangePicker 
          currentFilter={bottomFilter} 
          onFilterChange={setBottomFilter} 
        />
      </div>

      <div className={styles.chartsGrid}>
        
        {/* GRÁFICO ÚNICO E DETALHADO */}
        <div className={styles.chartContainer}>
          <div className={styles.chartTitle}>
            <span>Status SIP - {activeTab === 'call1' ? 'Primeira Tentativa' : 'Segunda Tentativa'}</span>
            <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6}}>
              <PhoneOutgoing size={14} />
              {totalCallsInView} Disparos nesta etapa
            </div>
          </div>

          <div style={{ width: '100%', height: 350 }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer>
                <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <defs>
                    {activeKeys.map((statusLabel) => {
                      const entry = Object.values(STATUS_MAP).find(v => v.label === statusLabel);
                      const color = entry?.color || '#888';
                      return (
                        <linearGradient key={statusLabel} id={`color-${statusLabel}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={color} stopOpacity={0.1}/>
                        </linearGradient>
                      );
                    })}
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  
                  <XAxis 
                    dataKey="name" axisLine={false} tickLine={false} 
                    tick={{ fill: axisColor, fontSize: 11, fontWeight: 600 }} dy={10} 
                  />
                  <YAxis 
                    axisLine={false} tickLine={false} 
                    tick={{ fill: axisColor, fontSize: 11 }} 
                  />
                  
                  <Tooltip 
                    contentStyle={tooltipStyle}
                    labelStyle={{color: theme === 'dark' ? '#fff' : '#000', fontWeight: 'bold', marginBottom:'8px'}}
                  />
                  
                  <Legend verticalAlign="top" iconType="circle" wrapperStyle={{paddingBottom: '20px', fontSize:'0.75rem'}}/>
                  
                  {activeKeys.map((statusLabel) => {
                    const entry = Object.values(STATUS_MAP).find(v => v.label === statusLabel);
                    const color = entry?.color || '#888';
                    return (
                      <Area 
                        key={statusLabel} 
                        type="monotone" 
                        dataKey={statusLabel} 
                        stackId="1" 
                        stroke={color} 
                        fill={`url(#color-${statusLabel})`}
                        strokeWidth={2}
                      />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', gap: '1rem'}}>
                {activeTab === 'call1' ? <PhoneMissed size={40} strokeWidth={1} /> : <PhoneMissed size={40} strokeWidth={1} />}
                <span>Nenhum dado encontrado para a {activeTab === 'call1' ? '1ª' : '2ª'} ligação no período.</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}