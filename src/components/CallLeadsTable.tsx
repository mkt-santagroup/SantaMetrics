import { useState, useMemo, useEffect, useRef } from 'react';
import { CallLead } from '@/types/callLeads';
import { 
  isSameDay, isAfter, addDays, isBefore, 
  parseISO, differenceInDays, isEqual, subDays 
} from 'date-fns';
import styles from './LeadsTable.module.css';
import { 
  CheckCircle, XCircle, Clock, Search, 
  ChevronLeft, ChevronRight, Filter, Phone, PhoneOff, AlertCircle, ChevronUp, ChevronDown, 
  CalendarClock, LogIn, Send, UserCheck, Hash 
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface CallLeadsTableProps {
  data: CallLead[];
  dateFilter: string;
}

const STATUS_CONFIG: Record<string, { label: string, color: string, bg: string, icon: any }> = {
  'ANSWERED': { label: 'Atendida', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)', icon: Phone },
  'NO ANSWER': { label: 'Sem Resposta', color: '#ca8a04', bg: 'rgba(202, 138, 4, 0.1)', icon: PhoneOff },
  'BUSY': { label: 'Ocupado', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.1)', icon: PhoneOff },
  'FAILED': { label: 'Falhou', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)', icon: AlertCircle },
  'CONGESTION': { label: 'Congestionado', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)', icon: AlertCircle },
  'NO_ROUTE': { label: 'Sem Rota', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', icon: AlertCircle },
  'ROUTE_UNAVAILABLE': { label: 'Rota Indisp.', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', icon: AlertCircle },
  'DUPLICATED': { label: 'Duplicado', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', icon: AlertCircle },
  'SENT': { label: 'Enviada', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', icon: Send }, 
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

  // --- 1. MOTOR DE SALVAMENTO (WRITE) ---
  // Mantive sua lógica original, apenas garantindo que os nomes dos campos batem com o schema
  useEffect(() => {
    const runUpdates = async () => {
      for (const item of data) {
        
        // A. Snapshot Inicial: Se tem Login, mas não tem o "snapshot" (last_login_static) salvo
        if (!item.last_login_static && item.Last_login) {
          await supabase
            .from('CALL-UNIVESO-RP-LEADS')
            .update({ last_login_static: item.Last_login })
            .eq('ID', item.ID);
          continue; 
        }

        // B. Conversão (Pós Login Logic)
        if (item.Last_login) {
          const liveLoginDate = parseISO(item.Last_login); 
          // Usa a hora da 1ª tentativa ou a criação do lead como referência
          const callReferenceStr = item.call1_hour || item.created_at; 
          
          if (callReferenceStr) {
            const callDate = parseISO(callReferenceStr);
            
            // Só salva se o login for POSTERIOR à call
            if (isAfter(liveLoginDate, callDate)) {
              const limitDate = addDays(callDate, 7); // Janela de 7 dias
              if (isBefore(liveLoginDate, limitDate)) {
                
                const currentSaved = item.pos_login_static ? parseISO(item.pos_login_static) : null;
                // Atualiza se não tiver salvo ainda OU se o novo login for mais recente
                const needsUpdate = !currentSaved || (isAfter(liveLoginDate, currentSaved) && !isEqual(liveLoginDate, currentSaved));

                if (needsUpdate) {
                  await supabase
                    .from('CALL-UNIVESO-RP-LEADS')
                    .update({ pos_login_static: item.Last_login }) 
                    .eq('ID', item.ID);
                }
              }
            }
          }
        }
      }
    };
    runUpdates();
  }, [data]);

  // --- 2. FILTROS ---
  const filteredData = useMemo(() => {
    const today = new Date();
    return data.filter((item) => {
      // Filtro de Data
      const itemDate = item.created_at ? new Date(item.created_at) : null;
      if (dateFilter !== 'lifetime' && !itemDate) return false;

      if (itemDate) {
        if (dateFilter === 'today' && !isSameDay(itemDate, today)) return false;
        if (dateFilter === 'yesterday' && !isSameDay(itemDate, subDays(today, 1))) return false;
        if (dateFilter === '7days' && !isAfter(itemDate, subDays(today, 7))) return false;
        if (dateFilter === '30days' && !isAfter(itemDate, subDays(today, 30))) return false;
      }

      // Filtro de Busca
      const searchLower = searchTerm.toLowerCase();
      const idString = item.ID ? item.ID.toString() : '';
      
      return (
        idString.includes(searchLower) ||
        (item.nome && item.nome.toLowerCase().includes(searchLower)) ||
        (item.whatsapp && item.whatsapp.includes(searchLower))
      );
    });
  }, [data, searchTerm, dateFilter]);

  // Paginação
  useEffect(() => setCurrentPage(1), [searchTerm, dateFilter, itemsPerPage]);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatTempo = (minutos: number | null) => {
    if (minutos === null) return '-';
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return horas > 0 ? `${horas}h ${mins}m` : `${mins}m`;
  };

  const formatData = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));
  };

  // --- 3. COMPONENTS AUXILIARES ---
  
  const StatusPosCallBadge = ({ item }: { item: CallLead }) => {
    const BadgeAntes = () => (
      <span style={{ 
        color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.85rem',
        background: 'rgba(139, 92, 246, 0.1)', padding: '4px 12px', borderRadius: '99px', width: 'fit-content'
      }}>
        <UserCheck size={14} /> Antes
      </span>
    );

    const BadgeNao = () => (
      <span style={{ 
        color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.85rem',
        background: 'rgba(239, 68, 68, 0.1)', padding: '4px 12px', borderRadius: '99px', width: 'fit-content'
      }}>
        <XCircle size={14} /> Não
      </span>
    );

    if (!item.pos_login_static) return <BadgeNao />;
    if (!item.call1_hour && !item.call2_hour) return <BadgeAntes />;

    const posLoginDate = parseISO(item.pos_login_static);
    const callRefStr = item.call1_hour || item.call2_hour;
    const callDate = callRefStr ? parseISO(callRefStr) : new Date();

    if (isBefore(posLoginDate, callDate)) {
      return <BadgeAntes />;
    }

    const diffDays = differenceInDays(posLoginDate, callDate);
    if (diffDays > 7) return <BadgeNao />;

    if (isSameDay(posLoginDate, callDate)) {
      return (
        <span style={{ 
          color: '#10b981', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.85rem',
          background: 'rgba(16, 185, 129, 0.1)', padding: '4px 12px', borderRadius: '99px', width: 'fit-content'
        }}>
          <CheckCircle size={14} /> Sim
        </span>
      );
    } else {
      return (
        <span style={{ 
          color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.85rem',
          background: 'rgba(59, 130, 246, 0.1)', padding: '4px 12px', borderRadius: '99px', width: 'fit-content'
        }}>
          <CalendarClock size={14} /> Depois
        </span>
      );
    }
  };

  const CallStatusCell = ({ status, timeStr }: { status: string | null, timeStr: string | null }) => {
    if (!status && !timeStr) return <span style={{color: 'var(--text-tertiary)', fontSize: '0.85rem'}}>-</span>;
    const finalStatus = status || (timeStr ? 'SENT' : '');
    const config = STATUS_CONFIG[finalStatus] || STATUS_CONFIG['SENT'];
    const Icon = config.icon;
    return (
      <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', gap:'4px'}}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px',
          backgroundColor: config.bg, color: config.color, fontSize: '0.75rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.05em', border: `1px solid ${config.color}20` 
        }}>
          {Icon && <Icon size={12} strokeWidth={3} />} {config.label}
        </span>
        {timeStr && (
          <span style={{fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginLeft: '4px'}}>
            às {formatData(timeStr)}
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
              type="text" placeholder="Buscar ID, Nome..." className={styles.searchInput}
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
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
            <th style={{textAlign: 'center'}}>Status Pós Call</th>
            <th>Último Login (Ref.)</th>
            <th>Pós Login</th>
            <th>1ª Ligação</th>
            <th>2ª Ligação</th>
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((item) => (
            <tr key={item.ID} className={styles.clickableRow}>
              <td className={styles.dateCell}>
                <div style={{display:'flex', flexDirection:'column', gap: 4}}>
                  <span style={{fontWeight: 800}}>#{item.ID}</span>
                  {/* EXIBIÇÃO DO NOVO CAMPO CALL_COUNT */}
                  {item.call_count !== null && item.call_count > 0 && (
                    <span style={{
                      fontSize: '0.65rem', background: 'var(--bg-hover)', color: 'var(--text-secondary)',
                      padding: '2px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: 3, width: 'fit-content'
                    }}>
                      <Hash size={10}/> {item.call_count}x
                    </span>
                  )}
                </div>
              </td>
              
              <td className={styles.nameCell}>
                <div style={{display:'flex', flexDirection:'column'}}>
                  <span style={{fontWeight: 700}}>{item.nome || <i style={{fontWeight:400, opacity:0.6}}>Desconhecido</i>}</span>
                  <span style={{fontSize:'0.75rem', color:'var(--text-secondary)', fontWeight:500, marginTop:2}}>{item.whatsapp || '-'}</span>
                </div>
              </td>
              <td>
                <div style={{display:'flex', alignItems:'center', gap:6, fontWeight:600, color:'var(--text-secondary)', fontSize:'0.9rem'}}>
                  <Clock size={14} />
                  {formatTempo(item.Tempo_de_jogo)}
                </div>
              </td>
              
              <td align="center">
                <StatusPosCallBadge item={item} />
              </td>
              
              <td className={styles.dateCell} style={{fontSize:'0.85rem', color: 'var(--text-secondary)'}}>
                {formatData(item.last_login_static || item.Last_login)} 
              </td>
              
              <td className={styles.dateCell} style={{fontSize:'0.85rem', fontWeight: 600, color: item.pos_login_static ? '#10b981' : 'var(--text-tertiary)'}}>
                {item.pos_login_static ? (
                  <div style={{display:'flex', alignItems:'center', gap:6}}>
                    <LogIn size={14} />
                    {formatData(item.pos_login_static)}
                  </div>
                ) : '-'}
              </td>
              
              <td><CallStatusCell status={item.call1_status} timeStr={item.call1_hour} /></td>
              <td><CallStatusCell status={item.call2_status} timeStr={item.call2_hour} /></td>
            </tr>
          ))}
          {filteredData.length === 0 && (
            <tr>
              <td colSpan={8} className={styles.emptyState}>
                <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem', padding: '3rem'}}>
                  <Filter size={40} strokeWidth={1} />
                  <span>Nenhum registro encontrado.</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      
      {/* PAGINAÇÃO IDENTICA */}
      {filteredData.length > 0 && (
        <div className={styles.pagination}>
          <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
            <span className={styles.pageInfo}>Mostrando <b>{paginatedData.length}</b> de <b>{filteredData.length}</b></span>
            <div className={styles.customSelectContainer} ref={dropdownRef}>
              <button className={styles.customSelectTrigger} onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                {itemsPerPage} por pág {isDropdownOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
              {isDropdownOpen && (
                <div className={styles.customSelectDropdown}>
                  {[10, 20, 50, 100].map(val => (
                    <div key={val} className={`${styles.customOption} ${itemsPerPage === val ? styles.customOptionSelected : ''}`} onClick={() => { setItemsPerPage(val); setIsDropdownOpen(false); }}>{val} por pág</div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={styles.pageButtons}>
            <button className={styles.pageBtn} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={18} /></button>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, padding: '0 10px' }}>Pág. {currentPage}</span>
            <button className={styles.pageBtn} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={18} /></button>
          </div>
        </div>
      )}
    </div>
  );
}