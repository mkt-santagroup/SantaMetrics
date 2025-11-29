import { useState, useMemo, useEffect } from 'react';
import { CallLead } from '@/types/callLeads';
import styles from './CallDashboardOverview.module.css';
import SmartChart from './SmartChart';
import DateRangePicker, { DateFilterType } from './DateRangePicker';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  parseISO, startOfDay, endOfDay, format, isValid, 
  eachDayOfInterval, isSameDay, subDays, addDays 
} from 'date-fns';
import { useTheme } from '@/context/ThemeContext';
import { 
  Phone, PhoneOff, AlertCircle, XCircle, HelpCircle, Activity, BarChart3, Send 
} from 'lucide-react';

interface CallDashboardOverviewProps {
  data: CallLead[];
  chartFilter: DateFilterType; 
  dateFilter: string; 
}

function PhoneMissedIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="23" x2="17" y1="1" y2="7"/><line x1="17" x2="23" y1="1" y2="7"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
  );
}

const STATUS_CONFIG: Record<string, { label: string, color: string, icon: any }> = {
  'ANSWERED': { label: 'Atendida', color: '#10b981', icon: Phone }, 
  'NO ANSWER': { label: 'Sem Resposta', color: '#eab308', icon: PhoneMissedIcon }, 
  'BUSY': { label: 'Ocupado', color: '#f97316', icon: PhoneOff }, 
  'FAILED': { label: 'Falhou', color: '#ef4444', icon: XCircle }, 
  'CONGESTION': { label: 'Congestionado', color: '#dc2626', icon: Activity }, 
  'NO_ROUTE': { label: 'Sem Rota', color: '#6b7280', icon: AlertCircle }, 
  'ROUTE_UNAVAILABLE': { label: 'Rota Indisp.', color: '#4b5563', icon: AlertCircle }, 
  'DUPLICATED': { label: 'Duplicado', color: '#8b5cf6', icon: AlertCircle }, 
  'SENT': { label: 'Enviada', color: '#52525b', icon: Send }, 
  'UNKNOWN': { label: 'Desconhecido', color: '#1f2937', icon: HelpCircle },
  'NULL': { label: 'Sem Status', color: '#9ca3af', icon: HelpCircle }
};

const FIXED_CARD_ORDER = [
  'ANSWERED', 'BUSY', 'CONGESTION', 'NO ANSWER', 'DUPLICATED', 
  'FAILED', 'NO_ROUTE', 'ROUTE_UNAVAILABLE', 'SENT', 'UNKNOWN', 'NULL'
];

export default function CallDashboardOverview({ data, chartFilter }: CallDashboardOverviewProps) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'call1' | 'call2'>('call1');
  const [bottomFilter, setBottomFilter] = useState<DateFilterType>({ label: 'Hoje', value: 'today', from: startOfDay(new Date()), to: endOfDay(new Date()) });
  const [visibleStatuses, setVisibleStatuses] = useState<string[]>([]); 

  // --- 1. FILTRAGEM BLINDADA (Ignora Timezone) ---
  const filteredData = useMemo(() => {
    if (bottomFilter.value === 'lifetime') return data;
    
    // Converte as datas do filtro para string "YYYY-MM-DD"
    const startStr = bottomFilter.from ? format(bottomFilter.from, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    const endStr = bottomFilter.to ? format(bottomFilter.to, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

    return data.filter(item => {
      if (!item.created_at) return false;
      // Pega a string do banco (ex: "2025-11-29")
      const itemDateStr = item.created_at.substring(0, 10);
      
      // Comparação lexical de strings (funciona perfeitamente para datas ISO)
      return itemDateStr >= startStr && itemDateStr <= endStr;
    });
  }, [data, bottomFilter]);

  // --- 2. PROCESSAMENTO ---
  const { chartData, statusTotals, totalCalls, cardStatuses, chartStatuses } = useMemo(() => {
    let start = bottomFilter.from ? startOfDay(bottomFilter.from) : startOfDay(new Date());
    let end = bottomFilter.to ? endOfDay(bottomFilter.to) : endOfDay(new Date());

    if (isSameDay(start, end)) {
      start = subDays(start, 1);
      end = addDays(end, 1);
    }

    const allDays = eachDayOfInterval({ start, end });
    const dailyMap: Record<string, any> = {};

    allDays.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      dailyMap[key] = { name: format(day, 'dd/MM'), rawDate: key };
    });

    const totals: Record<string, number> = {};
    const foundStatuses = new Set<string>();
    let totalCount = 0;

    // --- CARDS (Usa filteredData que já está corrigido) ---
    filteredData.forEach(item => {
      let isCountedForCard = false;
      let cardStatus: string | null = null;

      if (activeTab === 'call1') {
        if (item.called === true || item.called2 === true) {
          isCountedForCard = true;
          cardStatus = item.call1_status;
        }
      } else {
        if (item.called3 === true || item.called4 === true) {
          isCountedForCard = true;
          cardStatus = item.call2_status;
        }
      }

      if (isCountedForCard) {
        let statusKey = cardStatus ? cardStatus.trim().toUpperCase() : 'NULL';
        if (statusKey === '') statusKey = 'NULL';
        
        totalCount++;
        totals[statusKey] = (totals[statusKey] || 0) + 1;
      }
    });

    // --- GRÁFICO (Re-itera 'data' para garantir range visual correto) ---
    data.forEach(item => {
      if (!item.created_at) return;
      
      // FIX TIMEZONE: Usa a string do banco
      const dateKey = item.created_at.substring(0, 10);
      
      if (dailyMap[dateKey]) {
        // Processa CALL 1
        if (item.called || item.called2) {
          let s1 = item.call1_status ? item.call1_status.trim().toUpperCase() : 'NULL';
          if (s1 === '') s1 = 'NULL';
          foundStatuses.add(s1);
          dailyMap[dateKey][`call1_${s1}`] = (dailyMap[dateKey][`call1_${s1}`] || 0) + 1;
        }

        // Processa CALL 2
        if (item.called3 || item.called4) {
          let s2 = item.call2_status ? item.call2_status.trim().toUpperCase() : 'NULL';
          if (s2 === '') s2 = 'NULL';
          foundStatuses.add(s2);
          dailyMap[dateKey][`call2_${s2}`] = (dailyMap[dateKey][`call2_${s2}`] || 0) + 1;
        }
      }
    });

    const sortedData = Object.values(dailyMap).sort((a: any, b: any) => a.rawDate.localeCompare(b.rawDate));

    const existingStatuses = Array.from(foundStatuses);
    const orderedForCards = FIXED_CARD_ORDER.filter(s => existingStatuses.includes(s));
    existingStatuses.forEach(s => { if (!FIXED_CARD_ORDER.includes(s)) orderedForCards.push(s); });
    const orderedForChart = [...orderedForCards]; 

    return { 
      chartData: sortedData, 
      statusTotals: totals, 
      totalCalls: totalCount,
      cardStatuses: orderedForCards,
      chartStatuses: orderedForChart 
    };
  }, [filteredData, activeTab, bottomFilter, data]); 

  useEffect(() => {
    setVisibleStatuses(chartStatuses);
  }, [chartStatuses.length]); 

  const toggleStatus = (status: string) => {
    setVisibleStatuses(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const axisColor = theme === 'dark' ? '#9ca3af' : '#888';
  const gridColor = theme === 'dark' ? '#333' : '#f0f0f0';
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const call1Items = payload.filter((p: any) => p.dataKey.startsWith('call1_'));
      const call2Items = payload.filter((p: any) => p.dataKey.startsWith('call2_'));

      return (
        <div style={{
          backgroundColor: theme === 'dark' ? '#171717' : '#fff',
          border: theme === 'dark' ? '1px solid #333' : '1px solid #ddd',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          color: theme === 'dark' ? '#fff' : '#000',
          fontFamily: 'Montserrat, sans-serif',
          padding: '12px',
          minWidth: '200px'
        }}>
          <p style={{ fontWeight: '800', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>{label}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '6px' }}>1ª Ligação</p>
              {call1Items.map((item: any) => {
                 const originalStatus = item.dataKey.replace('call1_', '');
                 const config = STATUS_CONFIG[originalStatus] || { label: originalStatus };
                 return (
                   <div key={item.dataKey} style={{ color: item.color, fontSize: '0.8rem', fontWeight: '600', marginBottom: '2px' }}>
                     {config.label}: {item.value}
                   </div>
                 )
              })}
              {call1Items.length === 0 && <span style={{fontSize:'0.75rem', opacity:0.5}}>-</span>}
            </div>
            <div>
              <p style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '6px' }}>2ª Ligação</p>
              {call2Items.map((item: any) => {
                 const originalStatus = item.dataKey.replace('call2_', '');
                 const config = STATUS_CONFIG[originalStatus] || { label: originalStatus };
                 return (
                   <div key={item.dataKey} style={{ color: item.color, fontSize: '0.8rem', fontWeight: '600', marginBottom: '2px' }}>
                     {config.label}: {item.value}
                   </div>
                 )
              })}
              {call2Items.length === 0 && <span style={{fontSize:'0.75rem', opacity:0.5}}>-</span>}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.container}>
      
      <SmartChart data={data} dateFilter={chartFilter} />

      <div className={styles.sectionHeader}>
        <div className={styles.leftControls}>
          <h3 className={styles.sectionTitle}>Análise Técnica de Disparos</h3>
          <div className={styles.toggleGroup}>
            <button className={`${styles.toggleBtn} ${activeTab === 'call1' ? styles.activeToggle : ''}`} onClick={() => setActiveTab('call1')}>Dados dos Cards: 1ª Ligação</button>
            <button className={`${styles.toggleBtn} ${activeTab === 'call2' ? styles.activeToggle : ''}`} onClick={() => setActiveTab('call2')}>Dados dos Cards: 2ª Ligação</button>
          </div>
        </div>
        <DateRangePicker currentFilter={bottomFilter} onFilterChange={setBottomFilter} />
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard} style={{ cursor: 'default', borderColor: theme === 'dark' ? '#333' : '#e5e7eb' }}>
           <div className={styles.activeIndicator} style={{ background: theme === 'dark' ? '#fff' : '#000' }} />
           <div className={styles.statLabel}><BarChart3 size={14} /> Total (Aba Atual)</div>
           <div className={styles.statValue}>{totalCalls}</div>
        </div>
        {cardStatuses.map(status => {
          const config = STATUS_CONFIG[status] || { label: status, color: '#888', icon: HelpCircle };
          const Icon = config.icon;
          const count = statusTotals[status];
          const percent = totalCalls > 0 ? ((count / totalCalls) * 100).toFixed(1) : '0.0';
          const isActive = visibleStatuses.includes(status);
          return (
            <div key={status} className={`${styles.statCard} ${!isActive ? styles.cardInactive : ''}`} onClick={() => toggleStatus(status)} style={{ borderColor: isActive ? config.color : 'var(--border-color)' }}>
              <div className={styles.activeIndicator} style={{ background: isActive ? config.color : 'transparent' }} />
              <div className={styles.statLabel} style={{ color: isActive ? config.color : 'var(--text-secondary)' }}><Icon size={14} />{config.label}</div>
              <div className={styles.statValue}>{count} <span className={styles.statPercent}>{percent}%</span></div>
            </div>
          );
        })}
      </div>

      <div className={styles.chartContainer}>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <BarChart 
              data={chartData} 
              margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
              barGap={2}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
              
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: axisColor, fontSize: 11, fontWeight: 600 }} 
                dy={10} 
                minTickGap={30} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: axisColor, fontSize: 11 }} 
              />
              
              <Tooltip content={<CustomTooltip />} cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />

              <Legend 
                verticalAlign="top" 
                height={36} 
                iconType="circle"
                content={() => (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '10px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, background: '#fff', borderRadius: '50%', opacity: 0.8 }}></div> 1ª Ligação
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, background: '#fff', borderRadius: '50%', opacity: 0.4 }}></div> 2ª Ligação
                    </div>
                  </div>
                )}
              />

              {chartStatuses.map((status) => {
                if (!visibleStatuses.includes(status)) return null;
                const config = STATUS_CONFIG[status] || { color: '#888', label: status };
                return (
                  <Bar 
                    key={`call1-${status}`} 
                    dataKey={`call1_${status}`} 
                    name={status} 
                    stackId="a"
                    fill={config.color} 
                    radius={[0, 0, 0, 0]} 
                    barSize={24}
                    animationDuration={1000}
                  />
                );
              })}

              {chartStatuses.map((status) => {
                if (!visibleStatuses.includes(status)) return null;
                const config = STATUS_CONFIG[status] || { color: '#888', label: status };
                return (
                  <Bar 
                    key={`call2-${status}`} 
                    dataKey={`call2_${status}`} 
                    name={status} 
                    stackId="b"
                    fill={config.color} 
                    fillOpacity={0.6}
                    radius={[0, 0, 0, 0]} 
                    barSize={24}
                    animationDuration={1000}
                  />
                );
              })}

            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}