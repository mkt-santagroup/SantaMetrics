import { Lead } from '@/types/leads';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './DashboardOverview.module.css';
import { AlertTriangle, Users, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getStageName } from '@/utils/stageMap';
import { useTheme } from '@/context/ThemeContext'; // <--- IMPORTAR O TEMA

interface DashboardOverviewProps {
  leads: Lead[];
}

export default function DashboardOverview({ leads }: DashboardOverviewProps) {
  const { theme } = useTheme(); // <--- USAR O HOOK

  // Define cores baseadas no tema para o Recharts (que não aceita var() CSS nativamente fácil)
  const barColor = theme === 'dark' ? '#ffffff' : '#000000';
  const axisColor = theme === 'dark' ? '#9ca3af' : '#888';
  const gridColor = theme === 'dark' ? '#333' : '#f0f0f0';
  const tooltipBg = theme === 'dark' ? '#1f2937' : '#fff';
  const tooltipText = theme === 'dark' ? '#fff' : '#000';

  // 1. Lógica de KPIs
  const totalLeads = leads.length;
  const leadsConcluidos = leads.filter(l => l.etapa && l.etapa.includes('8')).length;
  const leadsEmAndamento = leads.filter(l => {
    const etapa = (l.etapa || '').toUpperCase();
    return etapa !== 'NOVO' && !etapa.includes('8') && etapa !== '';
  }).length;
  
  const conversaoRate = totalLeads > 0 ? ((leadsConcluidos / totalLeads) * 100).toFixed(1) : 0;

  // 2. Lógica de Gargalo
  const leadsPorEtapa = leads.reduce((acc, lead) => {
    const friendlyName = getStageName(lead.etapa); 
    if (!lead.etapa?.includes('8')) {
       acc[friendlyName] = (acc[friendlyName] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const dataEtapas = Object.entries(leadsPorEtapa)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value); 

  const maiorGargalo = dataEtapas.length > 0 ? dataEtapas[0].name : 'Nenhum';

  // 3. Gráfico
  const leadsPorDia = leads.reduce((acc, lead) => {
    const dataFormatada = format(new Date(lead.created_at), 'dd/MM', { locale: ptBR });
    acc[dataFormatada] = (acc[dataFormatada] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const dataGrafico = Object.entries(leadsPorDia).map(([name, leads]) => ({
    name,
    leads
  }));

  const CardIcon = ({ icon: Icon }: { icon: any }) => (
    <div className={styles.cardIcon}>
        <Icon size={28} strokeWidth={1.5} />
    </div>
  );

  return (
    <div className={styles.container}>
      {/* GRID COM 4 CARDS */}
      <div className={styles.gridCards}>
        
        <div className={styles.card}>
          <CardIcon icon={Users} />
          <div className={styles.cardContent}>
            <span className={styles.cardLabel}>Novos Leads</span>
            <h4 className={styles.cardValue}>{totalLeads}</h4>
          </div>
        </div>

        <div className={styles.card}>
          <CardIcon icon={Clock} />
          <div className={styles.cardContent}>
            <span className={styles.cardLabel}>Instalação em Andamento</span>
            <h4 className={styles.cardValue}>{leadsEmAndamento}</h4>
          </div>
        </div>

        <div className={styles.card}>
          <CardIcon icon={CheckCircle} />
          <div className={styles.cardContent}>
            <span className={styles.cardLabel}>Instalação Concluída</span>
            <div className={styles.cardValue}>
              {leadsConcluidos} <span className={styles.subValue}>({conversaoRate}%)</span>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <CardIcon icon={AlertTriangle} />
          <div className={styles.cardContent}>
            <span className={styles.cardLabel}>Maior Gargalo</span>
            <h4 className={styles.cardValue} style={{ fontSize: '1.25rem' }}>{maiorGargalo}</h4>
          </div>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartContainer}>
          <h3>Entrada de Leads Diária</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={dataGrafico}>
                {/* Cores dinâmicas aplicadas aqui */}
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: axisColor, fontSize: 12}} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: axisColor, fontSize: 12}} 
                />
                <Tooltip 
                  cursor={{fill: theme === 'dark' ? '#333' : '#f9fafb'}} 
                  contentStyle={{
                    fontFamily: 'Montserrat', 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    backgroundColor: tooltipBg,
                    color: tooltipText
                  }} 
                />
                {/* A cor da barra muda conforme o tema */}
                <Bar dataKey="leads" fill={barColor} radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LISTA DE GARGALOS */}
        <div className={styles.chartContainer}>
          <h3>Etapas com mais gargalos</h3>
          <div className={styles.stageList}>
            {dataEtapas.map((item) => (
              <div key={item.name} className={styles.stageRow}>
                <div className={styles.stageInfo}>
                  <span className={styles.stageName}>{item.name}</span>
                  <span className={styles.stageCount}>{item.value} leads</span>
                </div>
                <div className={styles.progressBarBg}>
                  <div 
                    className={styles.progressBarFill} 
                    style={{ width: `${(item.value / totalLeads) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
            {dataEtapas.length === 0 && <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>Sem gargalos registrados.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}