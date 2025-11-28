// src/components/CallLeadsTable.tsx
import { useState, useEffect, useRef } from 'react';
import { CallLead } from '@/types/callLeads';
import styles from './LeadsTable.module.css';
import { useCallFilters } from '@/hooks/useCallFilters';
import FilterToolbar from './FilterToolbar';
import { 
  Hash, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, XCircle, CheckCircle 
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { STATUS_CONFIG } from '@/utils/callStatusColors';

interface CallLeadsTableProps {
  data: CallLead[];
  dateFilter: string;
}

export default function CallLeadsTable({ data, dateFilter }: CallLeadsTableProps) {
  
  const { 
    filteredData, 
    searchTerm, setSearchTerm,
    sortKey, setSortKey,
    sortDirection, setSortDirection,
    posLoginFilter, setPosLoginFilter,
    call1StatusFilter, setCall1StatusFilter,
    call2StatusFilter, setCall2StatusFilter,
    resetFilters 
  } = useCallFilters(data);

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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => setCurrentPage(1), [filteredData.length]); 

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatData = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(parseISO(dateStr), 'dd/MM HH:mm');
  };

  const formatTempo = (minutos: number | null) => {
    if (minutos === null) return '-';
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return horas > 0 ? `${horas}h ${mins}m` : `${mins}m`;
  };

  const StatusPosCallBadge = ({ item }: { item: CallLead }) => {
    if (!item.pos_login_static) return <span style={{color:'#ef4444', fontWeight:700, fontSize:'0.8rem', display:'flex', gap:4, alignItems:'center', justifyContent: 'center'}}><XCircle size={14}/> Não</span>;
    return <span style={{color:'#10b981', fontWeight:700, fontSize:'0.8rem', display:'flex', gap:4, alignItems:'center', justifyContent: 'center'}}><CheckCircle size={14}/> Sim</span>;
  };

  const CallStatusCell = ({ status, timeStr }: { status: string | null, timeStr: string | null }) => {
    if (!status && !timeStr) return <span style={{color: 'var(--text-tertiary)', fontSize: '0.85rem'}}>-</span>;
    
    const finalStatus = status || (timeStr ? 'SENT' : 'UNKNOWN');
    const config = STATUS_CONFIG[finalStatus] || STATUS_CONFIG['UNKNOWN'];
    const Icon = config.icon;

    return (
      <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', gap:'2px'}}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '2px 8px', borderRadius: '6px',
          backgroundColor: config.bg, color: config.color, fontSize: '0.7rem', fontWeight: 700,
          textTransform: 'uppercase', border: `1px solid ${config.color}30` 
        }}>
          {Icon && <Icon size={10} strokeWidth={3} />} {config.label}
        </span>
        {timeStr && (
          <span style={{fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', marginLeft: '2px'}}>
            {formatData(timeStr)}
          </span>
        )}
      </div>
    );
  };

  return (
    // CORREÇÃO APLICADA AQUI: overflow: 'visible' para permitir que o menu flutue pra fora
    <div className={styles.tableContainer} style={{ background: 'transparent', boxShadow: 'none', overflow: 'visible' }}>
      
      <FilterToolbar 
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        sortDirection={sortDirection}
        onSortDirectionChange={setSortDirection}
        
        posLoginFilter={posLoginFilter}
        onPosLoginChange={setPosLoginFilter}

        call1StatusFilter={call1StatusFilter}
        onCall1StatusChange={setCall1StatusFilter}

        call2StatusFilter={call2StatusFilter}
        onCall2StatusChange={setCall2StatusFilter}

        onReset={resetFilters}
      />

      <div style={{ background: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 10px 30px -10px var(--shadow-color)' }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome / WhatsApp</th>
              <th>Tempo Jogo</th>
              <th style={{textAlign: 'center'}}>Pós Login</th>
              <th>Último Login</th>
              <th>Entrada Pós</th>
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
                    {item.call_count !== null && item.call_count > 0 && (
                      <span style={{fontSize: '0.65rem', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '4px', width:'fit-content'}}>
                        <Hash size={10}/> {item.call_count}x
                      </span>
                    )}
                  </div>
                </td>
                
                <td className={styles.nameCell}>
                  <div style={{display:'flex', flexDirection:'column'}}>
                    <span style={{fontWeight: 700, fontSize: '0.9rem'}}>{item.nome || <i style={{opacity:0.5}}>Sem nome</i>}</span>
                    <span style={{fontSize:'0.75rem', color:'var(--text-secondary)'}}>{item.whatsapp}</span>
                  </div>
                </td>

                <td><span style={{fontWeight:600, fontSize:'0.85rem'}}>{formatTempo(item.Tempo_de_jogo)}</span></td>
                
                <td align="center"><StatusPosCallBadge item={item} /></td>
                
                <td style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>{formatData(item.Last_login)}</td>
                
                <td style={{fontSize:'0.8rem', fontWeight:600, color: item.pos_login_static ? '#10b981' : 'var(--text-tertiary)'}}>
                  {formatData(item.pos_login_static)}
                </td>
                
                <td><CallStatusCell status={item.call1_status} timeStr={item.call1_hour} /></td>
                <td><CallStatusCell status={item.call2_status} timeStr={item.call2_hour} /></td>
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={8} style={{textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)'}}>
                  Nenhum registro encontrado com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {filteredData.length > 0 && (
          <div className={styles.pagination}>
            <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
              <span className={styles.pageInfo}><b>{filteredData.length}</b> registros</span>
              <div className={styles.customSelectContainer} ref={dropdownRef}>
                <button className={styles.customSelectTrigger} onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                  {itemsPerPage} por pág {isDropdownOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
                {isDropdownOpen && (
                  <div className={styles.customSelectDropdown}>
                    {[10, 20, 50, 100].map(val => (
                      <div key={val} className={styles.customOption} onClick={() => { setItemsPerPage(val); setIsDropdownOpen(false); }}>{val}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className={styles.pageButtons}>
              <button className={styles.pageBtn} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, padding: '0 8px' }}>{currentPage} / {totalPages}</span>
              <button className={styles.pageBtn} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}