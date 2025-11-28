import { useState, useMemo, useEffect } from 'react';
import { CallLead } from '@/types/callLeads';
import styles from './CallDashboardOverview.module.css';
import SmartChart from './SmartChart';
import DateRangePicker, { DateFilterType } from './DateRangePicker';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  parseISO, startOfDay, endOfDay, isWithinInterval, format, isValid, 
  eachDayOfInterval, isSameDay, subDays, addDays 
} from 'date-fns';
import { useTheme } from '@/context/ThemeContext';
import { 
  Phone, PhoneOff, AlertCircle, XCircle, HelpCircle, Activity, BarChart3 
} from 'lucide-react';

interface CallDashboardOverviewProps {
  data: CallLead[];
  chartFilter: DateFilterType; 
  dateFilter: string; 
}

// 1. CONFIGURAÇÃO VISUAL
const STATUS_CONFIG: Record<string, { label: string, color: string, icon: any }> = {
  'ANSWERED': { label: 'Atendida', color: '#10b981', icon: Phone }, 
  'NO ANSWER': { label: 'Sem Resposta', color: '#eab308', icon: PhoneMissedIcon }, 
  'BUSY': { label: 'Ocupado', color: '#f97316', icon: PhoneOff }, 
  'FAILED': { label: 'Falhou', color: '#ef4444', icon: XCircle }, 
  'CONGESTION': { label: 'Congestionado', color: '#dc2626', icon: Activity }, 
  'NO_ROUTE': { label: 'Sem Rota', color: '#6b7280', icon: AlertCircle }, 
  'ROUTE_UNAVAILABLE': { label: 'Rota Indisp.', color: '#4b5563', icon: AlertCircle }, 
  'DUPLICATED': { label: 'Duplicado', color: '#8b5cf6', icon: AlertCircle }, 
  'SENT': { label: 'Enviada', color: '#52525b', icon: Phone }, 
  'UNKNOWN': { label: 'Desconhecido', color: '#1f2937', icon: HelpCircle },
  'NULL': { label: 'Sem Status', color: '#9ca3af', icon: HelpCircle }
};

// 2. ORDEM FIXA DOS CARDS
const FIXED_CARD_ORDER = [
  'ANSWERED', 'BUSY', 'CONGESTION', 'NO ANSWER', 'DUPLICATED', 
  'FAILED', 'NO_ROUTE', 'ROUTE_UNAVAILABLE', 'SENT', 'UNKNOWN', 'NULL'
];

function PhoneMissedIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="23" x2="17" y1="1" y2="7"/><line x1="17" x2="23" y1="1" y2="7"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
  );
}

export default function CallDashboardOverview({ data, chartFilter }: CallDashboardOverviewProps) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'call1' | 'call2'>('call1');
  const [bottomFilter, setBottomFilter] = useState<DateFilterType>({ label: 'Hoje', value: 'today', from: startOfDay(new Date()), to: endOfDay(new Date()) });
  const [visibleStatuses, setVisibleStatuses] = useState<string[]>([]); 

  // --- 1. FILTRAGEM ---
  const filteredData = useMemo(() => {
    if (bottomFilter.value === 'lifetime') return data;
    const start = bottomFilter.from ? startOfDay(bottomFilter.from) : startOfDay(new Date());
    const end = bottomFilter.to ? endOfDay(bottomFilter.to) : endOfDay(new Date());

    return data.filter(item => {
      const refDateStr = item.created_at; 
      if (!refDateStr) return false;
      const itemDate = parseISO(refDateStr);
      return isWithinInterval(itemDate, { start, end });
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

    filteredData.forEach(item => {
      let isCounted = false;
      let rawStatus: string | null = null;
      let hourStr: string | null = null;

      if (activeTab === 'call1') {
        if (item.called === true || item.called2 === true) {
          isCounted = true;
          rawStatus = item.call1_status;
          hourStr = item.call1_hour || item.created_at;
        }
      } else {
        if (item.called3 === true || item.called4 === true) {
          isCounted = true;
          rawStatus = item.call2_status;
          hourStr = item.call2_hour || item.created_at;
        }
      }

      if (isCounted && hourStr) {
        let statusKey = rawStatus ? rawStatus.trim().toUpperCase() : 'NULL';
        if (statusKey === '') statusKey = 'NULL';

        const dateObj = parseISO(hourStr);
        if (isValid(dateObj)) {
          const userStart = bottomFilter.from ? startOfDay(bottomFilter.from) : startOfDay(new Date());
          const userEnd = bottomFilter.to ? endOfDay(bottomFilter.to) : endOfDay(new Date());
          
          if (isWithinInterval(dateObj, { start: userStart, end: userEnd }) || bottomFilter.value === 'lifetime') {
             totalCount++;
             foundStatuses.add(statusKey);
             totals[statusKey] = (totals[statusKey] || 0) + 1;
          }

          const dateKey = format(dateObj, 'yyyy-MM-dd');
          if (dailyMap[dateKey]) {
            dailyMap[dateKey][statusKey] = (dailyMap[dateKey][statusKey] || 0) + 1;
          }
        }
      }
    });

    const sortedData = Object.values(dailyMap).sort((a: any, b: any) => a.rawDate.localeCompare(b.rawDate));

    // Cards (Ordem Fixa)
    const existingStatuses = Array.from(foundStatuses);
    const orderedForCards = FIXED_CARD_ORDER.filter(s => existingStatuses.includes(s));
    existingStatuses.forEach(s => {
      if (!FIXED_CARD_ORDER.includes(s)) orderedForCards.push(s);
    });

    // Gráfico (Ordem por Volume: MAIOR -> MENOR para ficar na base da pilha)
    const orderedForChart = [...existingStatuses].sort((a, b) => {
      return (totals[b] || 0) - (totals[a] || 0); // Decrescente
    });

    return { 
      chartData: sortedData, 
      statusTotals: totals, 
      totalCalls: totalCount,
      cardStatuses: orderedForCards,
      chartStatuses: orderedForChart 
    };
  }, [filteredData, activeTab, bottomFilter]);

  useEffect(() => {
    setVisibleStatuses(prev => chartStatuses);
  }, [chartStatuses.length, activeTab]);

  const toggleStatus = (status: string) => {
    setVisibleStatuses(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const axisColor = theme === 'dark' ? '#9ca3af' : '#888';
  const gridColor = theme === 'dark' ? '#333' : '#f0f0f0';
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#171717' : '#fff',
    border: theme === 'dark' ? '1px solid #333' : '1px solid #ddd',
    borderRadius: '12px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    color: theme === 'dark' ? '#fff' : '#000',
    fontFamily: 'Montserrat, sans-serif'
  };

  return (
    <div className={styles.container}>
      
      <SmartChart data={data} dateFilter={chartFilter} />

      <div className={styles.sectionHeader}>
        <div className={styles.leftControls}>
          <h3 className={styles.sectionTitle}>Análise Técnica de Disparos</h3>
          <div className={styles.toggleGroup}>
            <button className={`${styles.toggleBtn} ${activeTab === 'call1' ? styles.activeToggle : ''}`} onClick={() => setActiveTab('call1')}>1ª Ligação (Call 1/2)</button>
            <button className={`${styles.toggleBtn} ${activeTab === 'call2' ? styles.activeToggle : ''}`} onClick={() => setActiveTab('call2')}>2ª Ligação (Call 3/4)</button>
          </div>
        </div>
        <DateRangePicker currentFilter={bottomFilter} onFilterChange={setBottomFilter} />
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard} style={{ cursor: 'default', borderColor: theme === 'dark' ? '#333' : '#e5e7eb' }}>
           <div className={styles.activeIndicator} style={{ background: theme === 'dark' ? '#fff' : '#000' }} />
           <div className={styles.statLabel}><BarChart3 size={14} /> Total Disparos</div>
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
        <div className={styles.chartHeaderInfo}>Visualizando {visibleStatuses.length} status selecionados</div>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                {chartStatuses.map((status) => {
                  const config = STATUS_CONFIG[status] || { color: '#888' };
                  return (
                    <linearGradient key={status} id={`grad-${status}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={config.color} stopOpacity={0.6}/>
                      <stop offset="95%" stopColor={config.color} stopOpacity={0}/>
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 11, fontWeight: 600 }} dy={10} minTickGap={30} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 11 }} />
              <Tooltip 
                contentStyle={tooltipStyle}
                labelStyle={{color: theme === 'dark' ? '#fff' : '#000', fontWeight: 'bold', marginBottom:'8px'}}
                cursor={{ stroke: theme === 'dark' ? '#555' : '#ccc', strokeWidth: 1 }}
                formatter={(value: number, name: string) => {
                    const config = STATUS_CONFIG[name] || { label: name };
                    return [value, config.label];
                }}
                itemSorter={(item) => -item.value!}
              />
              {/* O segredo do gráfico empilhado PADRÃO: stackId="1" */}
              {chartStatuses.map((status) => {
                if (!visibleStatuses.includes(status)) return null;
                const config = STATUS_CONFIG[status] || { color: '#888', label: status };
                
                return (
                  <Area 
                    key={status} 
                    type="monotone" 
                    dataKey={status} 
                    name={status} 
                    stackId="1" // <--- ISSO DEIXA IGUAL AO SMARTCHART (EMPILHADO)
                    stroke={config.color} 
                    fill={`url(#grad-${status})`}
                    strokeWidth={2}
                    animationDuration={800}
                    connectNulls={true} 
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}