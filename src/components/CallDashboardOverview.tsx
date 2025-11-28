import { useMemo } from 'react';
import { CallLead } from '@/types/callLeads';
import styles from './CallDashboardOverview.module.css';
import { 
  UserCheck, UserX, PhoneOutgoing, Users 
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { isSameDay, subDays, isAfter, differenceInDays, parseISO } from 'date-fns';
import { useTheme } from '@/context/ThemeContext';

interface CallDashboardOverviewProps {
  data: CallLead[];
  dateFilter: string;
}

// AQUI É STATUS_MAP
const STATUS_MAP: Record<string, { label: string, color: string }> = {
  'ANSWERED': { label: 'Atendidas', color: '#10b981' }, 
  'NO ANSWER': { label: 'Sem Resposta', color: '#eab308' }, 
  'BUSY': { label: 'Ocupado', color: '#f97316' }, 
  'FAILED': { label: 'Falhou', color: '#ef4444' }, 
  'CONGESTION': { label: 'Congestionado', color: '#dc2626' }, 
  'NO_ROUTE': { label: 'Sem Rota', color: '#6b7280' }, 
  'ROUTE_UNAVAILABLE': { label: 'Rota Indisp.', color: '#4b5563' }, 
  'DUPLICATED': { label: 'Duplicado', color: '#374151' }, 
  'PENDING': { label: 'Pendente', color: '#1f2937' },
  'SENT': { label: 'Enviada', color: '#6b7280' } 
};

export default function CallDashboardOverview({ data, dateFilter }: CallDashboardOverviewProps) {
  const { theme } = useTheme();

  const axisColor = theme === 'dark' ? '#9ca3af' : '#888';
  const gridColor = theme === 'dark' ? '#333' : '#f0f0f0';
  const tooltipBg = theme === 'dark' ? '#171717' : '#fff'; 
  const tooltipText = theme === 'dark' ? '#fff' : '#000';

  // --- 1. FILTRO DE DATA ---
  const filteredData = useMemo(() => {
    const today = new Date();
    
    return data.filter(item => {
      if (!item.created_at) return dateFilter === 'lifetime'; 
      const itemDate = new Date(item.created_at);

      if (dateFilter === 'today') return isSameDay(itemDate, today);
      if (dateFilter === 'yesterday') return isSameDay(itemDate, subDays(today, 1));
      if (dateFilter === '7days') return isAfter(itemDate, subDays(today, 7));
      if (dateFilter === '30days') return isAfter(itemDate, subDays(today, 30));
      return true;
    });
  }, [data, dateFilter]);

  // --- 2. CÁLCULOS DOS CARDS ---
  const totalLeads = filteredData.length;

  const logadosPosCall = filteredData.filter(item => {
    if (!item.pos_login_static) return false;
    
    // Se não teve ligação, é "Antes", então não conta aqui
    if (!item.call1_hour && !item.call2_hour) return false;

    const posLoginDate = parseISO(item.pos_login_static);
    const callReferenceStr = item.call1_hour || item.call2_hour;
    
    if (callReferenceStr) {
      const callDate = parseISO(callReferenceStr);
      const diffDays = differenceInDays(posLoginDate, callDate);
      if (diffDays > 7) return false; 
    }

    return true;
  }).length;

  const naoLogados = totalLeads - logadosPosCall;
  
  const totalCallsFeitas = filteredData.reduce((acc, curr) => {
    let count = 0;
    if (curr.call1_hour) count++; 
    if (curr.call2_hour) count++;
    return acc + count;
  }, 0);

  // --- 3. DADOS GRÁFICOS ---
  const dataPizza = [
    { name: 'Logaram Pós Call', value: logadosPosCall, color: '#10b981' }, 
    { name: 'Não Logaram', value: naoLogados, color: '#ef4444' },
  ];

  const getStatusCounts = (callNumber: 1 | 2) => {
    const counts: Record<string, number> = {};
    Object.values(STATUS_MAP).forEach(s => counts[s.label] = 0);

    filteredData.forEach(item => {
      let rawStatus = callNumber === 1 ? item.call1_status : item.call2_status;
      const hasHour = callNumber === 1 ? item.call1_hour : item.call2_hour;

      if (!rawStatus && hasHour) rawStatus = 'SENT';
      if (!rawStatus) return; 

      // CORREÇÃO: Usar STATUS_MAP em vez de STATUS_CONFIG
      const config = STATUS_MAP[rawStatus] || STATUS_MAP['PENDING'];
      counts[config.label] = (counts[config.label] || 0) + 1;
    });

    return counts;
  };

  const countsCall1 = getStatusCounts(1);
  const countsCall2 = getStatusCounts(2);

  const dataBarra = [
    { 
      name: '1ª Ligação', 
      ...countsCall1, 
      total: Object.values(countsCall1).reduce((a, b) => a + b, 0)
    },
    { 
      name: '2ª Ligação', 
      ...countsCall2,
      total: Object.values(countsCall2).reduce((a, b) => a + b, 0)
    },
  ];

  // Componentes auxiliares
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={styles.customTooltip} style={{backgroundColor: tooltipBg, borderColor: theme === 'dark' ? '#333' : '#ddd'}}>
          <div className={styles.tooltipTitle} style={{color: tooltipText}}>{label}</div>
          {payload.map((entry: any, index: number) => {
            if (entry.value === 0) return null; 
            return (
              <div key={index} className={styles.tooltipRow}>
                <span style={{color: entry.color, fontWeight: 600}}>{entry.name}:</span>
                <span className={styles.tooltipValue} style={{color: tooltipText}}>{entry.value}</span>
              </div>
            );
          })}
          <div className={styles.tooltipDivider}></div>
          <div className={styles.tooltipFooter} style={{color: tooltipText}}>
            <span>Total disparos:</span>
            <span className={styles.tooltipTotalValue}>{payload[0].payload.total}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CardIcon = ({ icon: Icon, bg, color }: { icon: any, bg: string, color: string }) => (
    <div className={styles.iconBox} style={{background: bg, color: color}}>
      <Icon size={20} />
    </div>
  );

  return (
    <div className={styles.container}>
      
      <div className={styles.gridCards}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Total de Leads</span>
            <CardIcon icon={Users} bg="var(--bg-hover)" color="var(--text-primary)" />
          </div>
          <div className={styles.cardValue}>{totalLeads}</div>
          <span className={styles.cardSub} style={{color: 'var(--text-secondary)'}}>
            No período selecionado
          </span>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Logaram Pós Call</span>
            <CardIcon icon={UserCheck} bg="#d1fae5" color="#059669" />
          </div>
          <div className={styles.cardValue}>{logadosPosCall}</div>
          <span className={styles.cardSub} style={{color: '#059669'}}>
            {totalLeads > 0 ? ((logadosPosCall/totalLeads)*100).toFixed(0) : 0}% conversão real
          </span>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Não Logaram</span>
            <CardIcon icon={UserX} bg="#fee2e2" color="#dc2626" />
          </div>
          <div className={styles.cardValue}>{naoLogados}</div>
          <span className={styles.cardSub} style={{color: '#dc2626'}}>
            Pendentes
          </span>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Total de Ligações</span>
            <CardIcon icon={PhoneOutgoing} bg="#f3f4f6" color="#000" />
          </div>
          <div className={styles.cardValue}>{totalCallsFeitas}</div>
          <span className={styles.cardSub} style={{color: 'var(--text-secondary)'}}>
            Tentativas realizadas
          </span>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        
        {/* GRÁFICO DE PIZZA */}
        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>Status de Login (Pós Call)</h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie 
                  data={dataPizza} 
                  innerRadius={60} 
                  outerRadius={80} 
                  paddingAngle={5} 
                  dataKey="value"
                  stroke="none"
                >
                  {dataPizza.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    borderRadius:'12px', border:'none', 
                    boxShadow:'0 10px 25px rgba(0,0,0,0.2)', 
                    backgroundColor: tooltipBg, color: tooltipText
                  }} 
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRÁFICO DE BARRAS */}
        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>Performance Detalhada de Ligações</h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={dataBarra} layout="vertical" barGap={4}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  tick={{fill: axisColor, fontSize: 12, fontWeight: 600}} 
                  width={80} 
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip cursor={{fill: 'transparent'}} content={<CustomBarTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }}/>
                {Object.values(STATUS_MAP).map((statusConfig) => (
                  <Bar 
                    key={statusConfig.label}
                    dataKey={statusConfig.label}
                    stackId="a"
                    fill={statusConfig.color}
                    radius={[0, 4, 4, 0]}
                    barSize={32}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}