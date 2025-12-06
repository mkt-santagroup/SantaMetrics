import { useMemo } from 'react';
import { CallLeadD2 } from '@/types/callLeadsD2';
import { differenceInDays, isSameDay, format, subDays, isWithinInterval } from 'date-fns';
import { AreaChart, Area, BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CheckCircle, Clock, Zap, XCircle, Users, PhoneIncoming, AlertCircle, Phone } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import DateRangePicker, { DateFilterType } from '@/components/DateRangePicker';

interface CallDashboardOverviewProps {
  leads: CallLeadD2[];
  // Props para controle externo (State Lifting)
  dateFilter: DateFilterType;
  onFilterChange: (filter: DateFilterType) => void;
  actions?: React.ReactNode; 
}

export default function CallDashboardOverview({ 
  leads, 
  dateFilter, 
  onFilterChange, 
  actions 
}: CallDashboardOverviewProps) {
  
  const { theme } = useTheme();

  // CORES E ESTILOS
  const isDark = theme === 'dark';
  const textColor = isDark ? '#ededed' : '#111827';
  const subTextColor = isDark ? '#a3a3a3' : '#6b7280';
  const gridColor = isDark ? '#262626' : '#f0f0f0';
  const cardBg = isDark ? '#171717' : '#ffffff';
  const borderColor = isDark ? '#262626' : '#e5e7eb';

  // --- 1. FILTRAR LEADS (Baseado na prop recebida do pai) ---
  const filteredLeads = useMemo(() => {
    if (dateFilter.value === 'lifetime') return leads;
    if (!dateFilter.from || !dateFilter.to) return leads;

    return leads.filter(lead => {
        if (!lead.created_at) return false;
        const leadDate = new Date(lead.created_at);
        return isWithinInterval(leadDate, { start: dateFilter.from!, end: dateFilter.to! });
    });
  }, [leads, dateFilter]);

  // --- 2. CÁLCULO DOS KPIS ---
  const stats = useMemo(() => {
    let total = 0;
    let atendidas = 0;
    let recuperadosDia = 0;
    let recuperadosDepois = 0;
    let recuperadosAntes = 0;
    let naoRecuperados = 0;
    let aguardando = 0;
    let totalCusto = 0;

    const today = new Date();

    filteredLeads.forEach(lead => {
      total++;
      
      const history = lead.call_history || [];
      let foiAtendido = false;
      if (Array.isArray(history)) {
          history.forEach((h: any) => {
              totalCusto += Number(h.price || 0);
              const st = (h.status || '').toLowerCase();
              if (st === 'answered' || st === 'human') foiAtendido = true;
          });
      }
      if (foiAtendido) atendidas++;

      if (lead.is_recovered && lead.current_last_login) {
        const loginDate = new Date(lead.current_last_login);
        if (!lead.called_at) {
            recuperadosAntes++;
        } else {
            const callDate = new Date(lead.called_at);
            if (loginDate.getTime() < callDate.getTime()) {
                recuperadosAntes++;
            } else if (isSameDay(loginDate, callDate)) {
                recuperadosDia++;
            } else {
                recuperadosDepois++;
            }
        }
      } else if (lead.called_at) {
        const callDate = new Date(lead.called_at);
        const dias = differenceInDays(today, callDate);
        if (dias > 7) naoRecuperados++;
        else aguardando++;
      } else {
        aguardando++; 
      }
    });

    return { total, atendidas, recuperadosDia, recuperadosDepois, recuperadosAntes, naoRecuperados, aguardando, totalCusto };
  }, [filteredLeads]);

  // --- 3. DADOS GRÁFICO (EVOLUÇÃO) ---
  const leadChartData = useMemo(() => {
    let start = dateFilter.from || subDays(new Date(), 30);
    let end = dateFilter.to || new Date();
    const daysDiff = differenceInDays(end, start);
    if (daysDiff > 31) start = subDays(end, 30);

    const daysMap = new Map();
    for (let i = 0; i <= differenceInDays(end, start); i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const key = format(d, 'yyyy-MM-dd');
        daysMap.set(key, { name: format(d, 'dd/MM'), total: 0, atendidas: 0, rec_dia: 0, rec_depois: 0, rec_antes: 0, nao_rec: 0, aguardando: 0 });
    }

    filteredLeads.forEach(lead => {
      if (!lead.created_at) return;
      const dateKey = lead.created_at.substring(0, 10);
      if (daysMap.has(dateKey)) {
        const entry = daysMap.get(dateKey);
        const today = new Date();
        entry.total++;

        const history = lead.call_history || [];
        if (Array.isArray(history) && history.some((h: any) => h.status?.toLowerCase() === 'answered')) {
            entry.atendidas++;
        }

        if (lead.is_recovered && lead.current_last_login) {
            const loginDate = new Date(lead.current_last_login);
            if (!lead.called_at) {
                entry.rec_antes++;
            } else {
                const callDate = new Date(lead.called_at);
                if (loginDate.getTime() < callDate.getTime()) entry.rec_antes++;
                else if (isSameDay(loginDate, callDate)) entry.rec_dia++;
                else entry.rec_depois++;
            }
        } else if (lead.called_at) {
            if (differenceInDays(today, new Date(lead.called_at)) > 7) entry.nao_rec++;
            else entry.aguardando++;
        } else {
            entry.aguardando++;
        }
      }
    });
    return Array.from(daysMap.values());
  }, [filteredLeads, dateFilter]);

  // --- 4. DADOS GRÁFICO (CHAMADAS) ---
  const callChartData = useMemo(() => {
    let start = dateFilter.from || subDays(new Date(), 30);
    let end = dateFilter.to || new Date();
    const daysDiff = differenceInDays(end, start);
    if (daysDiff > 31) start = subDays(end, 30);

    const daysMap = new Map();
    for (let i = 0; i <= differenceInDays(end, start); i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const key = format(d, 'yyyy-MM-dd');
        daysMap.set(key, { name: format(d, 'dd/MM'), answered: 0, no_answer: 0, failed: 0, busy: 0 });
    }

    filteredLeads.forEach(lead => {
        const history = lead.call_history || [];
        if (Array.isArray(history)) {
            history.forEach((h: any) => {
                const callDateRaw = h.date || lead.called_at; 
                if (!callDateRaw) return;
                const dateKey = callDateRaw.substring(0, 10);
                if (daysMap.has(dateKey)) {
                    const entry = daysMap.get(dateKey);
                    const st = (h.status || '').toUpperCase();
                    if (st === 'ANSWERED' || st === 'HUMAN') entry.answered++;
                    else if (st === 'NO ANSWER' || st === 'NO_ANSWER') entry.no_answer++;
                    else if (st === 'FAILED' || st === 'CONGESTION' || st === 'NO_ROUTE') entry.failed++;
                    else if (st === 'BUSY') entry.busy++;
                }
            });
        }
    });
    return Array.from(daysMap.values());
  }, [filteredLeads, dateFilter]);

  const calcPct = (val: number) => stats.total > 0 ? ((val / stats.total) * 100).toFixed(1) + '%' : '0%';

  const KpiCard = ({ label, value, sub, icon: Icon, color, borderC }: any) => (
    <div style={{
      background: cardBg, padding: '1.25rem', borderRadius: '16px', border: `1px solid ${borderC || borderColor}`,
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)', display: 'flex', flexDirection: 'column', gap: '8px',
      minWidth: '130px', flex: 1, position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: color }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: subTextColor, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
        <Icon size={14} style={{ color: color }} /> {label}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: textColor, lineHeight: 1 }}>{value}</div>
      {sub && <span style={{ fontSize: '0.8rem', color: subTextColor, fontWeight: 500 }}>{sub}</span>}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '2rem', animation: 'fadeIn 0.5s ease-out' }}>
      
      {/* HEADER REORGANIZADO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: textColor }}>
                Gerenciamento de Ligações <span style={{ marginLeft: 10, fontSize: '0.7rem', background: '#10b981', color: '#fff', padding: '4px 8px', borderRadius: '4px', verticalAlign: 'middle' }}>LIVE</span>
            </h2>
            <p style={{ color: subTextColor, fontSize: '0.9rem', marginTop: '4px', margin: 0 }}>
                Dados em tempo real
            </p>
        </div>
        
        {/* GRUPO DE AÇÕES + FILTRO */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {actions} {/* Botões Injetados aqui */}
            <div style={{ width: 1, height: 28, background: borderColor, margin: '0 4px' }} className="desktop-only-divider"></div>
            <DateRangePicker currentFilter={dateFilter} onFilterChange={onFilterChange} />
        </div>
      </div>

      {/* KPIS */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        <KpiCard label="Total Leads" value={stats.total} icon={Users} color="#3b82f6" />
        <KpiCard label="Atendidas" value={stats.atendidas} sub={calcPct(stats.atendidas)} icon={PhoneIncoming} color="#10b981" />
        <KpiCard label="Rec. no Dia" value={stats.recuperadosDia} sub={calcPct(stats.recuperadosDia)} icon={CheckCircle} color="#22c55e" />
        <KpiCard label="Rec. 7 Dias" value={stats.recuperadosDepois} sub={calcPct(stats.recuperadosDepois)} icon={Clock} color="#0ea5e9" />
        <KpiCard label="Voltou Antes" value={stats.recuperadosAntes} sub={calcPct(stats.recuperadosAntes)} icon={Zap} color="#8b5cf6" />
        <KpiCard label="Não Recup." value={stats.naoRecuperados} sub={calcPct(stats.naoRecuperados)} icon={XCircle} color="#ef4444" borderC="rgba(239, 68, 68, 0.3)" />
        <KpiCard label="Aguardando" value={stats.aguardando} sub={calcPct(stats.aguardando)} icon={AlertCircle} color="#f59e0b" />
        <div style={{ background: `linear-gradient(135deg, ${isDark ? '#371818' : '#fff1f2'} 0%, ${cardBg} 100%)`, padding: '1.25rem', borderRadius: '16px', border: '1px solid #fecaca', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '140px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}><Users size={14} /> Custo Total</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#dc2626' }}>R$ {stats.totalCusto.toFixed(2).replace('.', ',')}</div>
        </div>
      </div>

      {/* GRÁFICOS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '1.5rem' }}>
        {/* Tendência */}
        <div style={{ height: '350px', background: cardBg, borderRadius: '24px', padding: '1.5rem 2rem', border: `1px solid ${borderColor}`, boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.05)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700, color: textColor }}>Tendência de Recuperação</h3>
            <ResponsiveContainer width="100%" height="90%">
            <ComposedChart data={leadChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                <linearGradient id="colAguard" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                <linearGradient id="colRecDia" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: subTextColor, fontSize: 12, fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: subTextColor, fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', color: textColor }} itemStyle={{ fontSize: '0.8rem' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                <Area type="monotone" dataKey="total" name="Total" stroke="#3b82f6" fill="none" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="rec_dia" name="Rec. Dia" stroke="#22c55e" fill="url(#colRecDia)" strokeWidth={2} stackId="1" />
                <Area type="monotone" dataKey="rec_depois" name="Rec. 7 Dias" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.1} strokeWidth={2} stackId="1" />
                <Area type="monotone" dataKey="aguardando" name="Aguardando" stroke="#f59e0b" fill="url(#colAguard)" strokeWidth={2} />
                <Area type="monotone" dataKey="nao_rec" name="Perdidos" stroke="#ef4444" fill="none" strokeWidth={2} strokeDasharray="3 3" />
                <Line type="monotone" dataKey="atendidas" name="Atendidas" stroke="#10b981" strokeWidth={3} dot={{r:3}} />
            </ComposedChart>
            </ResponsiveContainer>
        </div>

        {/* Ligações */}
        <div style={{ height: '350px', background: cardBg, borderRadius: '24px', padding: '1.5rem 2rem', border: `1px solid ${borderColor}`, boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.05)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700, color: textColor, display:'flex', alignItems:'center', gap:8 }}>
                <Phone size={20} /> Performance de Ligações
            </h3>
            <ResponsiveContainer width="100%" height="90%">
            <BarChart data={callChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: subTextColor, fontSize: 12, fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: subTextColor, fontSize: 12 }} />
                <Tooltip cursor={{ fill: isDark ? '#333' : '#f3f4f6' }} contentStyle={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, borderRadius: '12px', color: textColor }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                <Bar dataKey="answered" name="Atendida" stackId="a" fill="#16a34a" radius={[0, 0, 4, 4]} />
                <Bar dataKey="no_answer" name="Sem Resposta" stackId="a" fill="#ca8a04" />
                <Bar dataKey="busy" name="Ocupado" stackId="a" fill="#ea580c" />
                <Bar dataKey="failed" name="Falha" stackId="a" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
            </ResponsiveContainer>
        </div>
      </div>

      <style jsx>{` @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } `}</style>
    </div>
  );
}