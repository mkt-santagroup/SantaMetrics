import { useMemo } from 'react';
import { CallLead } from '@/types/callLeads';
import styles from './CallDashboardOverview.module.css';
import { 
  UserCheck, UserX, Phone, PhoneCall
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

  const barColor = theme === 'dark' ? '#ffffff' : '#000000';
  const axisColor = theme === 'dark' ? '#9ca3af' : '#888';
  const gridColor = theme === 'dark' ? '#333' : '#f0f0f0';
  const tooltipBg = theme === 'dark' ? '#1f2937' : '#fff';
  const tooltipText = theme === 'dark' ? '#fff' : '#000';

  // --- FILTRO DE DATA CORRIGIDO (USANDO created_at) ---
  const filteredData = useMemo(() => {
    const today = new Date();
    
    return data.filter(item => {
      if (!item.created_at) return dateFilter === 'lifetime'; // Se não tem data, só mostra no lifetime
      
      const itemDate = new Date(item.created_at);

      if (dateFilter === 'today') return isSameDay(itemDate, today);
      if (dateFilter === 'yesterday') return isSameDay(itemDate, subDays(today, 1));
      if (dateFilter === '7days') return isAfter(itemDate, subDays(today, 7));
      if (dateFilter === '30days') return isAfter(itemDate, subDays(today, 30));
      return true;
    });
  }, [data, dateFilter]);

  // ... resto da lógica de KPIs (igual) ...
  const total = filteredData.length;
  const logadosHoje = filteredData.filter(i => i.login_no_dia === true).length;
  const naoLogados = filteredData.filter(i => i.login_no_dia === false || i.login_no_dia === null).length;
  const call1Feitas = filteredData.filter(i => i.call_1 === true).length;
  const call2Feitas = filteredData.filter(i => i.call_2 === true).length;
  const callPendentes = total - (filteredData.filter(i => i.call_1 === true || i.call_2 === true).length);

  const dataPizza = [
    { name: 'Online Hoje', value: logadosHoje, color: '#10b981' }, 
    { name: 'Offline', value: naoLogados, color: '#ef4444' },
  ];

  const dataBarra = [
    { name: 'Call 1', atendidas: call1Feitas, pendentes: total - call1Feitas },
    { name: 'Call 2', atendidas: call2Feitas, pendentes: total - call2Feitas },
  ];

  // ... return JSX (igual, usando filteredData) ...
  // (Código de renderização igual ao anterior, omiti para brevidade,
  //  o importante é que agora ele usa o filteredData baseado em created_at)
  
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
          <span className={styles.cardSub} style={{color: '#059669'}}>{total > 0 ? ((logadosHoje/total)*100).toFixed(0) : 0}% da base</span>
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
            <span className={styles.cardLabel}>Call 1 Sucesso</span>
            <CardIcon icon={Phone} bg="#e0f2fe" color="#0284c7" />
          </div>
          <div className={styles.cardValue}>{call1Feitas}</div>
          <span className={styles.cardSub} style={{color: 'var(--text-secondary)'}}>Primeiro contato</span>
        </div>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Call 2 Sucesso</span>
            <CardIcon icon={PhoneCall} bg="var(--bg-hover)" color="var(--text-secondary)" />
          </div>
          <div className={styles.cardValue}>{call2Feitas}</div>
          <span className={styles.cardSub} style={{color: 'var(--text-secondary)'}}>Recuperação</span>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>Status de Login (Hoje)</h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={dataPizza} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {dataPizza.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                </Pie>
                <Tooltip contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 25px rgba(0,0,0,0.1)', backgroundColor: tooltipBg, color: tooltipText}} />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>Performance de Ligações</h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={dataBarra} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{fill: axisColor, fontSize:12}} width={60} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 25px rgba(0,0,0,0.1)', backgroundColor: tooltipBg, color: tooltipText}} />
                <Legend />
                <Bar dataKey="atendidas" name="Atendidas" stackId="a" fill={barColor} radius={[0, 4, 4, 0]} barSize={30} />
                <Bar dataKey="pendentes" name="Pendentes" stackId="a" fill="#e5e7eb" radius={[0, 4, 4, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}