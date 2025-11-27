import { useMemo } from 'react';
import { CallLead } from '@/types/callLeads';
import styles from './CallDashboardOverview.module.css';
import { 
  UserCheck, UserX, Phone, PhoneCall, PhoneOutgoing 
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { isSameDay, subDays, isAfter } from 'date-fns';
import { useTheme } from '@/context/ThemeContext';

interface CallDashboardOverviewProps {
  data: CallLead[];
  dateFilter: string;
}

export default function CallDashboardOverview({ data, dateFilter }: CallDashboardOverviewProps) {
  const { theme } = useTheme();

  const axisColor = theme === 'dark' ? '#9ca3af' : '#888';
  const gridColor = theme === 'dark' ? '#333' : '#f0f0f0';
  const tooltipBg = theme === 'dark' ? '#1f2937' : '#fff'; 
  const tooltipText = theme === 'dark' ? '#fff' : '#000';

  const colorAtendida = '#10b981'; 
  const colorNaoAtendida = theme === 'dark' ? '#374151' : '#e5e7eb';

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

  // --- 2. CÁLCULOS GERAIS ---
  const total = filteredData.length;
  const logadosHoje = filteredData.filter(i => i.login_no_dia === true).length;
  const naoLogados = filteredData.filter(i => i.login_no_dia === false || i.login_no_dia === null).length;
  
  // Sucessos (Atendidas)
  const call1Sucesso = filteredData.filter(i => i.call_1 === true).length;
  const call2Sucesso = filteredData.filter(i => i.call_2 === true).length;

  // --- 3. NOVA LÓGICA DE TENTATIVAS ---
  
  // Grupo Call 1: Soma called + called2
  const tentativasCall1 = filteredData.reduce((acc, curr) => {
    let count = 0;
    if (curr.called === true) count++;
    if (curr.called2 === true) count++;
    return acc + count;
  }, 0);

  // Grupo Call 2: Soma called3 + called4
  const tentativasCall2 = filteredData.reduce((acc, curr) => {
    let count = 0;
    if (curr.called3 === true) count++;
    if (curr.called4 === true) count++;
    return acc + count;
  }, 0);

  // Total Geral
  const totalCallsFeitas = tentativasCall1 + tentativasCall2;

  // --- 4. DADOS GRÁFICOS ---
  const dataPizza = [
    { name: 'Online Hoje', value: logadosHoje, color: '#10b981' }, 
    { name: 'Offline', value: naoLogados, color: '#ef4444' },
  ];

  // Gráfico de Barras com Agrupamento
  const dataBarra = [
    { 
      name: '1ª Ligação', // (Inclui called + called2)
      Atendidas: call1Sucesso, 
      NaoAtendidas: Math.max(0, tentativasCall1 - call1Sucesso), 
      Tentativas: tentativasCall1
    },
    { 
      name: '2ª Ligação', // (Inclui called3 + called4)
      Atendidas: call2Sucesso, 
      NaoAtendidas: Math.max(0, tentativasCall2 - call2Sucesso),
      Tentativas: tentativasCall2
    },
  ];

  // --- 5. COMPONENTE TOOLTIP CUSTOMIZADO ---
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload; 
      return (
        <div className={styles.customTooltip}>
          <div className={styles.tooltipTitle}>{data.name}</div>
          
          <div className={styles.tooltipRow}>
            <span style={{color: '#10b981'}}>Atendidas:</span>
            <span className={styles.tooltipValue}>{data.Atendidas}</span>
          </div>
          
          <div className={styles.tooltipRow}>
            <span style={{color: '#9ca3af'}}>Não Atendidas:</span>
            <span className={styles.tooltipValue}>{data.NaoAtendidas}</span>
          </div>

          <div className={styles.tooltipDivider}></div>

          <div className={styles.tooltipFooter}>
            <span>Total tentativas:</span>
            <span className={styles.tooltipTotalValue}>
              {data.Tentativas}
            </span>
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
            <span className={styles.cardLabel}>Logaram Hoje</span>
            <CardIcon icon={UserCheck} bg="#d1fae5" color="#059669" />
          </div>
          <div className={styles.cardValue}>{logadosHoje}</div>
          <span className={styles.cardSub} style={{color: '#059669'}}>
            {total > 0 ? ((logadosHoje/total)*100).toFixed(0) : 0}% da base
          </span>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Não Logaram</span>
            <CardIcon icon={UserX} bg="#fee2e2" color="#dc2626" />
          </div>
          <div className={styles.cardValue}>{naoLogados}</div>
          <span className={styles.cardSub} style={{color: '#dc2626'}}>Atenção necessária</span>
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

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>1ª Ligação Atendida</span>
            <CardIcon icon={Phone} bg="#e0f2fe" color="#0284c7" />
          </div>
          <div className={styles.cardValue}>{call1Sucesso}</div>
          <span className={styles.cardSub} style={{color: 'var(--text-secondary)'}}>Primeiro contato</span>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>2ª Ligação Atendida</span>
            <CardIcon icon={PhoneCall} bg="var(--bg-hover)" color="var(--text-secondary)" />
          </div>
          <div className={styles.cardValue}>{call2Sucesso}</div>
          <span className={styles.cardSub} style={{color: 'var(--text-secondary)'}}>Recuperação</span>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        
        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>Status de Login (Hoje)</h3>
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
                    borderRadius:'12px', 
                    border:'none', 
                    boxShadow:'0 10px 25px rgba(0,0,0,0.2)', 
                    backgroundColor: tooltipBg, 
                    color: tooltipText
                  }} 
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>Performance de Ligações</h3>
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
                
                {/* TOOLTIP CUSTOMIZADO */}
                <Tooltip cursor={{fill: 'transparent'}} content={<CustomBarTooltip />} />
                
                <Legend iconType="circle" />
                <Bar 
                  dataKey="Atendidas" 
                  stackId="a" 
                  fill={colorAtendida} 
                  radius={[0, 0, 0, 0]} 
                  barSize={32} 
                />
                <Bar 
                  dataKey="NaoAtendidas" 
                  name="Não Atendidas" 
                  stackId="a" 
                  fill={colorNaoAtendida} 
                  radius={[0, 6, 6, 0]} 
                  barSize={32} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}