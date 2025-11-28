import { useState, useMemo, useEffect, useRef } from 'react';
import { CallLead } from '@/types/callLeads';
import { format, isSameDay, subDays, isAfter, addDays, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import styles from './LeadsTable.module.css';
import { 
  CheckCircle, XCircle, Clock, Search, 
  ChevronLeft, ChevronRight, Filter, Phone, PhoneOff, AlertCircle, ChevronUp, ChevronDown 
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient'; // <--- IMPORTANTE: Importar o cliente Supabase

interface CallLeadsTableProps {
  data: CallLead[];
  dateFilter: string;
}

// --- MAPA DE TRADUÇÃO E CORES ---
const STATUS_CONFIG: Record<string, { label: string, color: string, bg: string, icon: any }> = {
  'ANSWERED': { label: 'Atendida', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)', icon: Phone },
  'NO ANSWER': { label: 'Sem Resposta', color: '#ca8a04', bg: 'rgba(202, 138, 4, 0.1)', icon: PhoneOff },
  'BUSY': { label: 'Ocupado', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.1)', icon: PhoneOff },
  'FAILED': { label: 'Falhou', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)', icon: AlertCircle },
  'CONGESTION': { label: 'Congestionado', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)', icon: AlertCircle },
  'NO_ROUTE': { label: 'Sem Rota', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', icon: AlertCircle },
  'ROUTE_UNAVAILABLE': { label: 'Rota Indisp.', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', icon: AlertCircle },
  'DUPLICATED': { label: 'Duplicado', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', icon: AlertCircle },
};

export default function CallLeadsTable({ data, dateFilter }: CallLeadsTableProps) {
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // --- FUNÇÕES DE CÁLCULO ---

  // Verifica se o login foi no mesmo dia e após a call (Cálculo puro)
  const calculateIsPosCall = (item: CallLead): boolean => {
    if (!item.Last_login) return false;
    const loginDate = new Date(item.Last_login);

    const checkSameDayConversion = (callTimeStr: string | null) => {
      if (!callTimeStr) return false;
      const callDate = new Date(callTimeStr);
      // Regra: Login depois da call E no mesmo dia
      return isAfter(loginDate, callDate) && isSameDay(loginDate, callDate);
    };

    return checkSameDayConversion(item.call1_hour) || checkSameDayConversion(item.call2_hour);
  };

  // --- TRIGGER AUTOMÁTICO (UseEffect) ---
  useEffect(() => {
    // Esta função varre os dados atuais para ver se alguém converteu mas não está marcado no DB
    const updateConversions = async () => {
      // Filtra apenas quem precisa de update para evitar chamadas desnecessárias
      const leadsToUpdate = data.filter(item => {
        // Se já está TRUE no banco, ignora (já foi salvo)
        if (item.login_no_dia === true) return false;

        // Se está FALSE ou NULL, verifica se o cálculo diz que deveria ser TRUE
        const shouldBeTrue = calculateIsPosCall(item);
        return shouldBeTrue;
      });

      if (leadsToUpdate.length === 0) return;

      // Executa o update no Supabase para cada lead encontrado
      // Nota: Idealmente faríamos um update em massa, mas loop simples funciona para volume moderado
      for (const lead of leadsToUpdate) {
        try {
          console.log(`Atualizando Lead #${lead.ID} para login_no_dia = TRUE`);
          await supabase
            .from('CALL-UNIVESO-RP-LEADS')
            .update({ login_no_dia: true })
            .eq('ID', lead.ID);
        } catch (err) {
          console.error(`Erro ao atualizar lead ${lead.ID}:`, err);
        }
      }
    };

    updateConversions();
  }, [data]); // Roda sempre que "data" muda (ex: realtime ou fetch inicial)


  // --- LÓGICA DE FILTRAGEM ---
  const filteredData = useMemo(() => {
    const today = new Date();

    return data.filter((item) => {
      const dateToCheck = item.created_at ? new Date(item.created_at) : null;
      let matchesDate = true;
      
      if (dateToCheck) {
        if (dateFilter === 'today') matchesDate = isSameDay(dateToCheck, today);
        else if (dateFilter === 'yesterday') matchesDate = isSameDay(dateToCheck, subDays(today, 1));
        else if (dateFilter === '7days') matchesDate = isAfter(dateToCheck, subDays(today, 7));
        else if (dateFilter === '30days') matchesDate = isAfter(dateToCheck, subDays(today, 30));
      } 
      if (dateFilter !== 'lifetime' && !dateToCheck) matchesDate = false; 
      if (!matchesDate) return false;

      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        item.ID.toString().includes(searchLower) ||
        (item.nome && item.nome.toLowerCase().includes(searchLower)) ||
        (item.whatsapp && item.whatsapp.includes(searchLower));
      
      return matchesSearch;
    });
  }, [data, searchTerm, dateFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  // --- HELPERS DE FORMATAÇÃO ---
  const formatData = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), "dd/MM HH:mm", { locale: ptBR });
  };

  const formatHora = (dateStr: string | null) => {
    if (!dateStr) return null;
    return format(new Date(dateStr), "HH:mm", { locale: ptBR });
  };

  const formatTempo = (minutos: number | null) => {
    if (minutos === null) return '-';
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas > 0) return `${horas}h ${mins}m`;
    return `${mins}m`;
  };

  const BooleanBadge = ({ value }: { value: boolean | null }) => {
    // Aqui usamos o valor direto do banco (value), que agora será persistente
    if (value === true) return <span style={{color: '#16a34a', display:'flex', alignItems:'center', gap:4, fontWeight:600, fontSize:'0.85rem'}}><CheckCircle size={14}/> Sim</span>;
    // Se não é true, assumimos não (vermelho)
    return <span style={{color: '#dc2626', display:'flex', alignItems:'center', gap:4, fontWeight:600, fontSize:'0.85rem'}}><XCircle size={14}/> Não</span>;
  };

  // Cálculo da janela de 7 dias (Visual apenas)
  const checkFezLogin7Days = (item: CallLead): boolean => {
    if (!item.Last_login) return false;
    const loginDate = new Date(item.Last_login);

    const checkWindow = (callTimeStr: string | null) => {
      if (!callTimeStr) return false;
      const callDate = new Date(callTimeStr);
      const limitDate = addDays(callDate, 7); 
      return isAfter(loginDate, callDate) && isBefore(loginDate, limitDate);
    };
    return checkWindow(item.call1_hour) || checkWindow(item.call2_hour);
  };

  const FezLoginBadge = ({ value }: { value: boolean }) => {
     if (value === true) return <span style={{color: 'var(--text-primary)', fontWeight:700, fontSize:'0.85rem'}}>Sim</span>;
     return <span style={{color: 'var(--text-tertiary)', fontSize:'0.85rem'}}>Não</span>;
  };

  const CallStatusCell = ({ status, timeStr }: { status: string | null, timeStr: string | null }) => {
    if (!status && !timeStr) return <span style={{color: 'var(--text-tertiary)', fontSize: '0.85rem'}}>-</span>;
    
    const config = STATUS_CONFIG[status || ''] || { 
      label: status || 'Desconhecido', 
      color: 'var(--text-primary)', 
      bg: 'var(--bg-hover)', 
      icon: null 
    };
    const Icon = config.icon;
    const horaFormatada = formatHora(timeStr);

    return (
      <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', gap:'4px'}}>
        {status && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '6px',
            backgroundColor: config.bg,
            color: config.color,
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            border: `1px solid ${config.color}20` 
          }}>
            {Icon && <Icon size={12} strokeWidth={3} />}
            {config.label}
          </span>
        )}
        {horaFormatada && (
          <span style={{fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginLeft: '4px'}}>
            às {horaFormatada}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={styles.tableContainer}>
      
      <div style={{ padding: '1.5rem 2rem 0 2rem' }}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <Search size={18} color="var(--text-tertiary)" />
            <input 
              type="text" 
              placeholder="Buscar por ID, Nome ou Whats..." 
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Nome / WhatsApp</th>
            <th>Tempo Jogo</th>
            <th>Pós Call</th>
            <th>Fez Login (7d)</th>
            <th>Último Login</th>
            <th>1ª Ligação</th>
            <th>2ª Ligação</th>
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((item) => {
            
            // Aqui usamos APENAS o valor do banco para exibição.
            // O useEffect lá em cima cuida de transformar FALSE em TRUE se a regra bater.
            const displayPosCall = item.login_no_dia; 
            
            const fezLogin7d = checkFezLogin7Days(item);

            return (
              <tr key={item.ID} className={styles.clickableRow}>
                <td className={styles.dateCell} style={{ fontWeight: 800 }}>
                  #{item.ID}
                </td>
                <td className={styles.nameCell}>
                  <div style={{display:'flex', flexDirection:'column'}}>
                    <span style={{fontWeight: 700}}>{item.nome || <i style={{color:'var(--text-tertiary)', fontWeight:400}}>Desconhecido</i>}</span>
                    <span style={{fontSize:'0.75rem', color:'var(--text-secondary)', fontWeight:500, marginTop:2}}>{item.whatsapp || '-'}</span>
                  </div>
                </td>
                <td>
                  <div style={{display:'flex', alignItems:'center', gap:6, fontWeight:600, color:'var(--text-secondary)', fontSize:'0.9rem'}}>
                    <Clock size={14} />
                    {formatTempo(item.Tempo_de_jogo)}
                  </div>
                </td>
                
                {/* Exibe o valor do DB. Se for TRUE, fica verde pra sempre */}
                <td><BooleanBadge value={displayPosCall} /></td>
                
                <td><FezLoginBadge value={fezLogin7d} /></td>

                <td className={styles.dateCell} style={{fontSize:'0.85rem'}}>
                  {formatData(item.Last_login)}
                </td>
                <td>
                  <CallStatusCell status={item.call1_status} timeStr={item.call1_hour} />
                </td>
                <td>
                  <CallStatusCell status={item.call2_status} timeStr={item.call2_hour} />
                </td>
              </tr>
            );
          })}
          
          {filteredData.length === 0 && (
            <tr>
              <td colSpan={8} className={styles.emptyState} style={{ padding: '4rem' }}>
                <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem'}}>
                  <Filter size={40} strokeWidth={1} />
                  <span>Nenhum registro encontrado.</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {filteredData.length > 0 && (
        <div className={styles.pagination}>
          <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
            <span className={styles.pageInfo}>
              Mostrando <b>{paginatedData.length}</b> de <b>{filteredData.length}</b>
            </span>
            <div className={styles.customSelectContainer} ref={dropdownRef}>
              <button 
                className={styles.customSelectTrigger} 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                {itemsPerPage} por pág
                {isDropdownOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
              {isDropdownOpen && (
                <div className={styles.customSelectDropdown}>
                  {[10, 20, 30, 50, 100].map(val => (
                    <div 
                      key={val}
                      className={`${styles.customOption} ${itemsPerPage === val ? styles.customOptionSelected : ''}`}
                      onClick={() => { setItemsPerPage(val); setIsDropdownOpen(false); }}
                    >
                      {val} por pág
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={styles.pageButtons}>
            <button 
              className={styles.pageBtn} 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={18} />
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Página {currentPage} de {totalPages}
            </span>
            <button 
              className={styles.pageBtn} 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}