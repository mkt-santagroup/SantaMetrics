import { useState, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  format, parseISO, eachDayOfInterval, 
  isSameDay, differenceInDays, startOfDay, endOfDay, min, subDays, addDays 
} from 'date-fns'; 
import styles from './SmartChart.module.css';
import { CallLead } from '@/types/callLeads';
import { Users, PhoneIncoming, CheckCircle2, Sparkles, CalendarClock } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { DateFilterType } from './DateRangePicker';

interface SmartChartProps {
  data: CallLead[];
  dateFilter: DateFilterType;
}

const METRICS_CONFIG = {
  total: { label: 'Total de Leads', color: '#4285F4', icon: Users },      
  answered: { label: 'Atendidas', color: '#34A853', icon: PhoneIncoming }, 
  posCallSameDay: { label: 'Recuperados no Dia', color: '#FBBC05', icon: CheckCircle2 }, 
  posCall7d: { label: 'Recuperados (7 Dias)', color: '#3B82F6', icon: CalendarClock }, 
  organic: { label: 'Recuperados Antes', color: '#A142F4', icon: Sparkles }   
};

export default function SmartChart({ data, dateFilter }: SmartChartProps) {
  const { theme } = useTheme();
  
  const [activeMetrics, setActiveMetrics] = useState<string[]>([
    'total', 'answered', 'posCallSameDay', 'posCall7d', 'organic'
  ]);

  const toggleMetric = (key: string) => {
    if (activeMetrics.includes(key)) {
      if (activeMetrics.length > 1) {
        setActiveMetrics(prev => prev.filter(m => m !== key));
      }
    } else {
      setActiveMetrics(prev => [...prev, key]);
    }
  };

  const { chartData, totals } = useMemo(() => {
    // --- 1. DEFINIÇÃO INTELIGENTE DO INTERVALO ---
    let start: Date;
    let end: Date;

    if (dateFilter.value === 'lifetime') {
      if (data.length > 0) {
        const validDates = data
          .filter(d => d.created_at)
          .map(d => parseISO(d.created_at!));
        
        if (validDates.length > 0) {
          start = startOfDay(min(validDates)); 
        } else {
          start = subDays(new Date(), 30);
        }
      } else {
        start = subDays(new Date(), 30);
      }
      end = endOfDay(new Date());
    } else {
      start = dateFilter.from ? startOfDay(dateFilter.from) : startOfDay(new Date());
      end = dateFilter.to ? endOfDay(dateFilter.to) : endOfDay(new Date());
    }

    if (isSameDay(start, end)) {
      start = subDays(start, 1);
      end = addDays(end, 1);
    }

    // --- 2. GERAÇÃO DO ESQUELETO ---
    const allDays = eachDayOfInterval({ start, end });
    const aggregated: Record<string, any> = {};
    
    allDays.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      aggregated[key] = { 
        date: key, 
        displayDate: format(day, 'dd/MM'), 
        total: 0, answered: 0, posCallSameDay: 0, posCall7d: 0, organic: 0 
      };
    });

    const totalCounts = { total: 0, answered: 0, posCallSameDay: 0, posCall7d: 0, organic: 0 };

    // --- STRINGS DE COMPARAÇÃO PARA O FILTRO (IGNORA TIMEZONE) ---
    const filterStartStr = dateFilter.from ? format(dateFilter.from, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    const filterEndStr = dateFilter.to ? format(dateFilter.to, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

    // --- 3. PREENCHIMENTO ---
    data.forEach(lead => {
      if (!lead.created_at) return;
      
      // FIX TIMEZONE: Pega os primeiros 10 caracteres (YYYY-MM-DD) direto do banco
      const dateKey = lead.created_at.substring(0, 10);
      
      if (!aggregated[dateKey] && dateFilter.value !== 'lifetime') return;

      // FIX TIMEZONE PARA OS CARDS (TOTAIS):
      // Usa comparação de strings ao invés de isBefore/isAfter com Date Objects
      const isInUserRange = dateFilter.value === 'lifetime' 
        ? true 
        : (dateKey >= filterStartStr && dateKey <= filterEndStr);

      if (aggregated[dateKey]) aggregated[dateKey].total++;
      if (isInUserRange) totalCounts.total++;

      // B. Atendidas
      const isAnswered = lead.call1_status === 'ANSWERED' || lead.call2_status === 'ANSWERED';
      if (isAnswered) {
        if (aggregated[dateKey]) aggregated[dateKey].answered++;
        if (isInUserRange) totalCounts.answered++;
      }

      // C. Lógica de Conversão
      if (lead.pos_login_static) {
        const posLoginDate = parseISO(lead.pos_login_static);
        
        let callDate: Date | null = null;
        if (lead.call1_hour) callDate = parseISO(lead.call1_hour);
        else if (lead.call2_hour) callDate = parseISO(lead.call2_hour);

        // 1. RECUPERADO NO DIA
        if (callDate && isSameDay(posLoginDate, callDate)) {
          if (aggregated[dateKey]) aggregated[dateKey].posCallSameDay++;
          if (isInUserRange) totalCounts.posCallSameDay++;
        }
        // 2. RECUPERADO ANTES
        else if (!callDate || (callDate && posLoginDate < callDate)) { // Fix lógico simples
          if (aggregated[dateKey]) aggregated[dateKey].organic++;
          if (isInUserRange) totalCounts.organic++;
        }
        // 3. RECUPERADO 7 DIAS
        else {
          const diffDays = differenceInDays(posLoginDate, callDate!);
          if (diffDays <= 7) {
            if (aggregated[dateKey]) aggregated[dateKey].posCall7d++;
            if (isInUserRange) totalCounts.posCall7d++;
          }
        }
      }
    });

    const sortedData = Object.values(aggregated).sort((a: any, b: any) => 
      a.date.localeCompare(b.date)
    );

    return { chartData: sortedData, totals: totalCounts };
  }, [data, dateFilter]); 

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#333' : '#eee';
  const textColor = isDark ? '#9ca3af' : '#666';

  return (
    <div className={styles.container}>
      
      <div className={styles.headerGrid}>
        {(Object.keys(METRICS_CONFIG) as Array<keyof typeof METRICS_CONFIG>).map((key) => {
          const config = METRICS_CONFIG[key];
          const isActive = activeMetrics.includes(key);
          const Icon = config.icon;
          
          let percent = 0;
          if (key !== 'total' && totals.total > 0) {
            percent = (totals[key] / totals.total) * 100;
          }

          return (
            <div 
              key={key} 
              className={`${styles.metricCard} ${isActive ? styles.cardActive : ''}`}
              onClick={() => toggleMetric(key)}
            >
              <div className={styles.activeIndicator} style={{ backgroundColor: isActive ? config.color : 'transparent' }} />
              
              <div className={styles.labelRow} style={{ color: isActive ? config.color : 'var(--text-secondary)' }}>
                <Icon size={14} />
                {config.label}
              </div>
              
              <div className={styles.mainValue}>
                {totals[key]}
                {key !== 'total' && <span className={styles.subValue}>({percent.toFixed(1)}%)</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.chartArea}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {Object.entries(METRICS_CONFIG).map(([key, config]) => (
                <linearGradient key={key} id={`color-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={config.color} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={config.color} stopOpacity={0}/>
                </linearGradient>
              ))}
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            
            <XAxis 
              dataKey="displayDate" 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: textColor, fontSize: 11}} 
              dy={10} 
              interval="preserveStartEnd"
              minTickGap={30}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: textColor, fontSize: 11}} 
            />
            
            <Tooltip 
              contentStyle={{
                backgroundColor: isDark ? '#171717' : '#fff',
                borderColor: isDark ? '#333' : '#ddd',
                borderRadius: '8px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                padding: '12px'
              }}
              labelStyle={{ color: isDark ? '#fff' : '#000', fontWeight: 'bold', marginBottom: '8px' }}
            />

            {(Object.keys(METRICS_CONFIG) as Array<keyof typeof METRICS_CONFIG>).map((key) => {
              if (!activeMetrics.includes(key)) return null;
              return (
                <Area 
                  key={key}
                  type="monotone" 
                  dataKey={key} 
                  name={METRICS_CONFIG[key].label}
                  stroke={METRICS_CONFIG[key].color} 
                  fillOpacity={1} 
                  fill={`url(#color-${key})`} 
                  strokeWidth={2.5}
                  animationDuration={1000}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}