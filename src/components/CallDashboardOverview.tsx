import { useState, useMemo, useEffect } from 'react';
import { CallLead } from '@/types/callLeads';
import styles from './CallDashboardOverview.module.css';
import SmartChart from './SmartChart';
import DateRangePicker, { DateFilterType } from './DateRangePicker';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  parseISO, startOfDay, endOfDay, format, eachDayOfInterval, isSameDay, subDays, addDays, min, isWithinInterval 
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
  
  // Estado local do filtro de data (inicia como Hoje)
  const [bottomFilter, setBottomFilter] = useState<DateFilterType>({ 
    label: 'Hoje', 
    value: 'today', 
    from: startOfDay(new Date()), 
    to: endOfDay(new Date()) 
  });
  
  const [visibleStatuses, setVisibleStatuses] = useState<string[]>([]); 

  // --- 1. FILTRAGEM CORRETA PELO 'CREATED_AT' ---
  const filteredData = useMemo(() => {
    // Se for 'lifetime', não filtra nada, retorna tudo
    if (bottomFilter.value === 'lifetime') return data;
    
    // Datas de início e fim do filtro
    const startDate = bottomFilter.from || startOfDay(new Date());
    const endDate = bottomFilter.to || endOfDay(new Date());

    return data.filter(item => {
      if (!item.created_at) return false;
      
      // Converte a data do banco (UTC) para objeto Date local
      const itemDate = parseISO(item.created_at);
      
      // Verifica se está dentro do intervalo (inclusivo)
      return isWithinInterval(itemDate, { start: startDate, end: endDate });
    });
  }, [data, bottomFilter]);

  // --- 2. PROCESSAMENTO DE DADOS (Contagem e Agrupamento) ---
  const { chartData, statusTotals, totalCalls, cardStatuses, chartStatuses } = useMemo(() => {
    
    // --- Definição do Intervalo do Eixo X (Dias) ---
    let start: Date;
    let end: Date;

    if (bottomFilter.value === 'lifetime') {
      // Se for lifetime, busca a data mais antiga no dataset
      if (filteredData.length > 0) {
        const validDates = filteredData
          .filter(d => d.created_at)
          .map(d => parseISO(d.created_at!));
        start = validDates.length > 0 ? startOfDay(min(validDates)) : subDays(new Date(), 30);
      } else {
        start = subDays(new Date(), 7); // Fallback padrão
      }
      end = endOfDay(new Date());
    } else {
      // Se não for lifetime, usa o filtro selecionado
      start = bottomFilter.from ? startOfDay(bottomFilter.from) : startOfDay(new Date());
      end = bottomFilter.to ? endOfDay(bottomFilter.to) : endOfDay(new Date());
    }

    // Garante que o intervalo seja válido para o eachDayOfInterval
    if (start > end) start = end;

    // Gera todos os dias do intervalo para o gráfico
    const allDays = eachDayOfInterval({ start, end });
    const dailyMap: Record<string, any> = {};

    allDays.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      dailyMap[key] = { name: format(day, 'dd/MM'), rawDate: key };
    });

    const totals: Record<string, number> = {};
    const foundStatuses = new Set<string>();
    let totalAttemptsCount = 0; // Contador de tentativas (Total Calls)

    // --- LOOP PRINCIPAL ---
    filteredData.forEach(item => {
      if (!item.created_at) return;
      const itemDate = parseISO(item.created_at);
      const dateKey = format(itemDate, 'yyyy-MM-dd');

      // Se o dia está fora do range visual do gráfico, ignoramos para o gráfico, 
      // mas se o filtro for lifetime, o dailyMap deve cobrir tudo.
      if (!dailyMap[dateKey]) {
         // Se for lifetime e cair aqui, podemos adicionar dinamicamente ou ignorar. 
         // Com a lógica acima de 'start', deve cobrir.
         if (bottomFilter.value !== 'lifetime') return;
         // Se for lifetime, cria a chave on-the-fly se faltou (segurança)
         dailyMap[dateKey] = { name: format(itemDate, 'dd/MM'), rawDate: dateKey };
      }

      // --- LÓGICA DE CONTAGEM DE TENTATIVAS (TOTAL) ---
      let attemptsInThisTab = 0;
      if (activeTab === 'call1') {
        if (item.called) attemptsInThisTab++;
        if (item.called2) attemptsInThisTab++;
      } else {
        if (item.called3) attemptsInThisTab++;
        if (item.called4) attemptsInThisTab++;
      }
      totalAttemptsCount += attemptsInThisTab;

      // --- LÓGICA DE STATUS (TEXTO) ---
      // Pega o status textual correspondente à aba
      const rawStatus = activeTab === 'call1' ? item.call1_status : item.call2_status;
      const cleanStatus = rawStatus ? rawStatus.trim().toUpperCase() : '';

      // Se tiver status válido (não nulo/vazio), contabiliza
      if (cleanStatus && cleanStatus !== 'NULL') {
        // Totais para os Cards
        totals[cleanStatus] = (totals[cleanStatus] || 0) + 1;
        
        // Totais por Dia para o Gráfico
        // Chave do gráfico ex: "call1_ANSWERED" ou "call2_BUSY"
        const chartKey = `${activeTab}_${cleanStatus}`;
        dailyMap[dateKey][chartKey] = (dailyMap[dateKey][chartKey] || 0) + 1;
        
        foundStatuses.add(cleanStatus);
      }
    });

    // Ordena os dias cronologicamente
    const sortedData = Object.values(dailyMap).sort((a: any, b: any) => a.rawDate.localeCompare(b.rawDate));

    // Prepara lista de status para renderizar
    const existingStatuses = Array.from(foundStatuses);
    const orderedForCards = FIXED_CARD_ORDER.filter(s => existingStatuses.includes(s));
    // Adiciona status não mapeados ao final
    existingStatuses.forEach(s => { 
        if (!FIXED_CARD_ORDER.includes(s)) orderedForCards.push(s); 
    });
    
    return { 
      chartData: sortedData, 
      statusTotals: totals, 
      totalCalls: totalAttemptsCount, // Total de 'TRUEs'
      cardStatuses: orderedForCards,
      chartStatuses: [...orderedForCards] 
    };
  }, [filteredData, activeTab, bottomFilter]); 

  // Atualiza visibilidade quando novos status aparecem
  useEffect(() => {
    setVisibleStatuses(chartStatuses);
  }, [chartStatuses.length, JSON.stringify(chartStatuses)]); 

  const toggleStatus = (status: string) => {
    setVisibleStatuses(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const axisColor = theme === 'dark' ? '#9ca3af' : '#888';
  const gridColor = theme === 'dark' ? '#333' : '#f0f0f0';
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Filtra payload baseado na aba ativa para não poluir
      const currentTabPrefix = `${activeTab}_`;
      const items = payload.filter((p: any) => p.dataKey.startsWith(currentTabPrefix));

      return (
        <div style={{
          backgroundColor: theme === 'dark' ? '#171717' : '#fff',
          border: theme === 'dark' ? '1px solid #333' : '1px solid #ddd',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          color: theme === 'dark' ? '#fff' : '#000',
          fontFamily: 'Montserrat, sans-serif',
          padding: '12px',
          minWidth: '180px',
          zIndex: 100
        }}>
          <p style={{ fontWeight: '800', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>{label}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '2px' }}>
              {activeTab === 'call1' ? '1ª Ligação' : '2ª Ligação'}
            </p>
            {items.map((item: any) => {
               const originalStatus = item.dataKey.replace(currentTabPrefix, '');
               const config = STATUS_CONFIG[originalStatus] || { label: originalStatus };
               return (
                 <div key={item.dataKey} style={{ color: item.color, fontSize: '0.8rem', fontWeight: '600' }}>
                   {config.label}: {item.value}
                 </div>
               )
            })}
            {items.length === 0 && <span style={{fontSize:'0.75rem', opacity:0.5}}>Sem dados</span>}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.container}>
      
      {/* Gráfico Principal (Global) */}
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

      {/* Cards de Status */}
      <div className={styles.statsGrid}>
        {/* Card de Total de Tentativas */}
        <div className={styles.statCard} style={{ cursor: 'default', borderColor: theme === 'dark' ? '#333' : '#e5e7eb' }}>
           <div className={styles.activeIndicator} style={{ background: theme === 'dark' ? '#fff' : '#000' }} />
           <div className={styles.statLabel}><BarChart3 size={14} /> Tentativas Totais</div>
           <div className={styles.statValue}>{totalCalls}</div>
        </div>
        
        {/* Cards Dinâmicos por Status */}
        {cardStatuses.map(status => {
          const config = STATUS_CONFIG[status] || { label: status, color: '#888', icon: HelpCircle };
          const Icon = config.icon;
          const count = statusTotals[status];
          // Porcentagem em relação ao total de STATUS capturados (não de tentativas)
          // Isso evita distorção se houver muitas tentativas sem status
          const totalStatusCount = Object.values(statusTotals).reduce((a, b) => a + b, 0);
          const percent = totalStatusCount > 0 ? ((count / totalStatusCount) * 100).toFixed(1) : '0.0';
          const isActive = visibleStatuses.includes(status);
          
          return (
            <div 
              key={status} 
              className={`${styles.statCard} ${!isActive ? styles.cardInactive : ''}`} 
              onClick={() => toggleStatus(status)} 
              style={{ borderColor: isActive ? config.color : 'var(--border-color)' }}
            >
              <div className={styles.activeIndicator} style={{ background: isActive ? config.color : 'transparent' }} />
              <div className={styles.statLabel} style={{ color: isActive ? config.color : 'var(--text-secondary)' }}>
                <Icon size={14} />{config.label}
              </div>
              <div className={styles.statValue}>
                {count} <span className={styles.statPercent}>{percent}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Gráfico de Barras */}
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
                      <div style={{ width: 10, height: 10, background: '#fff', borderRadius: '50%', opacity: 0.8 }}></div>
                      {activeTab === 'call1' ? '1ª Ligação' : '2ª Ligação'}
                    </div>
                  </div>
                )}
              />

              {/* Renderiza as Barras baseadas na Aba Ativa */}
              {chartStatuses.map((status) => {
                if (!visibleStatuses.includes(status)) return null;
                const config = STATUS_CONFIG[status] || { color: '#888', label: status };
                const dataKey = `${activeTab}_${status}`; // Ex: call1_ANSWERED

                return (
                  <Bar 
                    key={dataKey} 
                    dataKey={dataKey} 
                    name={status} 
                    stackId="a" // Empilha tudo numa única barra por dia
                    fill={config.color} 
                    radius={[0, 0, 0, 0]} // Raio zero para empilhamento limpo
                    barSize={32}
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