// src/components/SmartChart.tsx
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
import { Users, PhoneIncoming, CheckCircle2, Sparkles, CalendarClock, DollarSign } from 'lucide-react'; // Importei DollarSign
import { useTheme } from '@/context/ThemeContext';
import { DateFilterType } from './DateRangePicker';

interface SmartChartProps {
  data: CallLead[];
  dateFilter: DateFilterType;
}

// Configuração das métricas (Adicionei 'cost')
const METRICS_CONFIG = {
  total: { label: 'Total de Leads', color: '#4285F4', icon: Users, isCurrency: false },      
  answered: { label: 'Atendidas', color: '#34A853', icon: PhoneIncoming, isCurrency: false }, 
  posCallSameDay: { label: 'Recuperados no Dia', color: '#FBBC05', icon: CheckCircle2, isCurrency: false }, 
  posCall7d: { label: 'Recuperados (7 Dias)', color: '#3B82F6', icon: CalendarClock, isCurrency: false }, 
  organic: { label: 'Recuperados Antes', color: '#A142F4', icon: Sparkles, isCurrency: false },
  // Nova métrica de custo (Vermelho para chamar atenção)
  cost: { label: 'Custo Total', color: '#EF4444', icon: DollarSign, isCurrency: true } 
};

export default function SmartChart({ data, dateFilter }: SmartChartProps) {
  const { theme } = useTheme();
  
  // Ativa o 'cost' por padrão
  const [activeMetrics, setActiveMetrics] = useState<string[]>([
    'total', 'answered', 'cost'
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

  // Função auxiliar para converter string "0.15" em número 0.15
  const parseCost = (val: string | number | null): number => {
    if (!val) return 0;
    // Troca vírgula por ponto se necessário, garante float
    const normalized = String(val).replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  };

  // Formatador de Moeda (R$)
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const { chartData, totals } = useMemo(() => {
    // --- 1. DEFINIÇÃO DE DATAS ---
    let start: Date;
    let end: Date;

    if (dateFilter.value === 'lifetime') {
      if (data.length > 0) {
        const validDates = data.filter(d => d.created_at).map(d => parseISO(d.created_at!));
        start = validDates.length > 0 ? startOfDay(min(validDates)) : subDays(new Date(), 30);
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

    // --- 2. PREPARAR DADOS ---
    const allDays = eachDayOfInterval({ start, end });
    const aggregated: Record<string, any> = {};
    
    allDays.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      aggregated[key] = { 
        date: key, 
        displayDate: format(day, 'dd/MM'), 
        total: 0, answered: 0, posCallSameDay: 0, posCall7d: 0, organic: 0, cost: 0 
      };
    });

    const totalCounts = { total: 0, answered: 0, posCallSameDay: 0, posCall7d: 0, organic: 0, cost: 0 };

    const filterStartStr = dateFilter.from ? format(dateFilter.from, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    const filterEndStr = dateFilter.to ? format(dateFilter.to, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

    // --- 3. SOMAR VALORES ---
    data.forEach(lead => {
      if (!lead.created_at) return;
      const dateKey = lead.created_at.substring(0, 10);
      
      if (!aggregated[dateKey] && dateFilter.value !== 'lifetime') return;

      const isInUserRange = dateFilter.value === 'lifetime' 
        ? true 
        : (dateKey >= filterStartStr && dateKey <= filterEndStr);

      // SOMA DOS CUSTOS (0.15 + 0.20...)
      const leadCost = 
        parseCost(lead.call1_custo) + 
        parseCost(lead.call2_custo) + 
        parseCost(lead.call3_custo) + 
        parseCost(lead.call4_custo);

      if (aggregated[dateKey]) aggregated[dateKey].cost += leadCost;
      if (isInUserRange) totalCounts.cost += leadCost;

      // Métricas de Contagem
      if (aggregated[dateKey]) aggregated[dateKey].total++;
      if (isInUserRange) totalCounts.total++;

      const isAnswered = lead.call1_status === 'ANSWERED' || lead.call2_status === 'ANSWERED';
      if (isAnswered) {
        if (aggregated[dateKey]) aggregated[dateKey].answered++;
        if (isInUserRange) totalCounts.answered++;
      }

      if (lead.pos_login_static) {
        const posLoginDate = parseISO(lead.pos_login_static);
        let callDate: Date | null = null;
        if (lead.call1_hour) callDate = parseISO(lead.call1_hour);
        else if (lead.call2_hour) callDate = parseISO(lead.call2_hour);

        if (callDate && isSameDay(posLoginDate, callDate)) {
          if (aggregated[dateKey]) aggregated[dateKey].posCallSameDay++;
          if (isInUserRange) totalCounts.posCallSameDay++;
        }
        else if (!callDate || (callDate && posLoginDate < callDate)) {
          if (aggregated[dateKey]) aggregated[dateKey].organic++;
          if (isInUserRange) totalCounts.organic++;
        }
        else {
          const diffDays = differenceInDays(posLoginDate, callDate!);
          if (diffDays <= 7) {
            if (aggregated[dateKey]) aggregated[dateKey].posCall7d++;
            if (isInUserRange) totalCounts.posCall7d++;
          }
        }
      }
    });

    const sortedData = Object.values(aggregated).sort((a: any, b: any) => a.date.localeCompare(b.date));

    return { chartData: sortedData, totals: totalCounts };
  }, [data, dateFilter]); 

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#333' : '#eee';
  const textColor = isDark ? '#9ca3af' : '#666';

  return (
    <div className={styles.container}>
      
      {/* Cards de Métricas */}
      <div className={styles.headerGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        {(Object.keys(METRICS_CONFIG) as Array<keyof typeof METRICS_CONFIG>).map((key) => {
          const config = METRICS_CONFIG[key];
          const isActive = activeMetrics.includes(key);
          const Icon = config.icon;
          
          let displayValue: string | number = totals[key];
          if (config.isCurrency) {
             displayValue = formatCurrency(totals[key]); // Ex: R$ 1.250,00
          }

          let percent = 0;
          // Não calcula % para custo, pois misturar R$ com Qtd não faz sentido
          if (key !== 'total' && key !== 'cost' && totals.total > 0) {
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
              
              <div className={styles.mainValue} style={{ fontSize: config.isCurrency ? '1.3rem' : '1.6rem' }}>
                {displayValue}
                {key !== 'total' && key !== 'cost' && <span className={styles.subValue}>({percent.toFixed(1)}%)</span>}
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
            
            {/* EIXO ESQUERDO (LEADS) */}
            <YAxis 
              yAxisId="left"
              axisLine={false} 
              tickLine={false} 
              tick={{fill: textColor, fontSize: 11}} 
            />

            {/* EIXO DIREITO (DINHEIRO) - Só aparece se 'cost' estiver ativo */}
            <YAxis 
              yAxisId="right"
              orientation="right"
              axisLine={false} 
              tickLine={false} 
              tick={{fill: METRICS_CONFIG.cost.color, fontSize: 11, fontWeight: 600}} 
              tickFormatter={(val) => `R$ ${val}`} // Formata eixo Y
              hide={!activeMetrics.includes('cost')}
            />
            
            <Tooltip 
              formatter={(value: any, name: any, props: any) => {
                // Formatação dentro do Tooltip (hover)
                if (props.dataKey === 'cost') return [formatCurrency(value), 'Custo'];
                return [value, name];
              }}
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
              
              // Se for custo, usa o eixo da direita (right), senão o da esquerda (left)
              const yAxisId = key === 'cost' ? 'right' : 'left';

              return (
                <Area 
                  key={key}
                  type="monotone" 
                  dataKey={key} 
                  yAxisId={yAxisId} 
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