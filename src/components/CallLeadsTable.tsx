import { useState, useMemo, useEffect, useRef } from 'react'; // Adicionado useRef
import { CallLead } from '@/types/callLeads';
import { format, isSameDay, subDays, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import styles from './LeadsTable.module.css';
import { 
  CheckCircle, XCircle, Clock, Search, 
  ChevronLeft, ChevronRight, Filter, Phone, PhoneOff, AlertCircle, ChevronUp, ChevronDown 
} from 'lucide-react';

interface CallLeadsTableProps {
  data: CallLead[];
  dateFilter: string;
}

// --- MAPA DE TRADUÇÃO E CORES ---
const STATUS_CONFIG: Record<string, { label: string, color: string, bg: string, icon: any }> = {
  'ANSWERED': { label: 'Atendida', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)', icon: Phone },
  'NO ANSWER': { label: 'Não atendida', color: '#ca8a04', bg: 'rgba(202, 138, 4, 0.1)', icon: PhoneOff },
  'BUSY': { label: 'Ocupado', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.1)', icon: PhoneOff },
  'FAILED': { label: 'Falhou', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)', icon: AlertCircle },
  'CONGESTION': { label: 'Congestionado', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)', icon: AlertCircle },
  'NO_ROUTE': { label: 'Sem Rota', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', icon: AlertCircle },
  'ROUTE_UNAVAILABLE': { label: 'Rota Indisp.', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', icon: AlertCircle },
  'DUPLICATED': { label: 'Duplicado', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', icon: AlertCircle },
};

export default function CallLeadsTable({ data, dateFilter }: CallLeadsTableProps) {
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Estado para o Dropdown Customizado
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown se clicar fora
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

      let matchesStatus = true;
      if (statusFilter === 'online') matchesStatus = item.login_no_dia === true;
      else if (statusFilter === 'offline') matchesStatus = item.login_no_dia === false || item.login_no_dia === null;

      return matchesSearch && matchesStatus;
    });
  }, [data, searchTerm, statusFilter, dateFilter]);

  // Resetar página ao filtrar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFilter, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const formatData = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), "dd/MM HH:mm", { locale: ptBR });
  };

  const formatTempo = (minutos: number | null) => {
    if (minutos === null) return '-';
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas > 0) return `${horas}h ${mins}m`;
    return `${mins}m`;
  };

  const BooleanBadge = ({ value }: { value: boolean | null }) => {
    if (value === true) return <span style={{color: '#16a34a', display:'flex', alignItems:'center', gap:4, fontWeight:600, fontSize:'0.85rem'}}><CheckCircle size={14}/> Sim</span>;
    if (value === false) return <span style={{color: '#dc2626', display:'flex', alignItems:'center', gap:4, fontWeight:600, fontSize:'0.85rem'}}><XCircle size={14}/> Não</span>;
    return <span style={{color: 'var(--text-tertiary)'}}>-</span>;
  };

  // Componente de Status
  const StatusBadge = ({ status }: { status: string | null }) => {
    if (!status) return <span style={{color: 'var(--text-tertiary)', fontSize: '0.85rem'}}>-</span>;
    
    const config = STATUS_CONFIG[status] || { 
      label: status, 
      color: 'var(--text-primary)', 
      bg: 'var(--bg-hover)', 
      icon: null 
    };

    const Icon = config.icon;

    return (
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

          <div className={styles.filterTabs}>
            <button 
              className={`${styles.filterTab} ${statusFilter === 'all' ? styles.filterTabActive : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              Todos
            </button>
            <button 
              className={`${styles.filterTab} ${statusFilter === 'online' ? styles.filterTabActive : ''}`}
              onClick={() => setStatusFilter('online')}
              style={{ color: statusFilter === 'online' ? '#16a34a' : '' }}
            >
              Logou Hoje
            </button>
            <button 
              className={`${styles.filterTab} ${statusFilter === 'offline' ? styles.filterTabActive : ''}`}
              onClick={() => setStatusFilter('offline')}
              style={{ color: statusFilter === 'offline' ? '#dc2626' : '' }}
            >
              Offline Hoje
            </button>
          </div>
        </div>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Nome / WhatsApp</th>
            <th>Tempo Jogo</th>
            <th>Login Hoje?</th>
            <th>1ª Ligação</th>
            <th>2ª Ligação</th>
            <th>Último Login</th>
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((item) => (
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
              <td><BooleanBadge value={item.login_no_dia} /></td>
              <td><StatusBadge status={item.call1_status} /></td>
              <td><StatusBadge status={item.call2_status} /></td>
              <td className={styles.dateCell} style={{fontSize:'0.85rem'}}>
                {formatData(item.Last_login)}
              </td>
            </tr>
          ))}
          
          {filteredData.length === 0 && (
            <tr>
              <td colSpan={7} className={styles.emptyState} style={{ padding: '4rem' }}>
                <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem'}}>
                  <Filter size={40} strokeWidth={1} />
                  <span>Nenhum registro encontrado para este período/filtro.</span>
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
            
            {/* DROPDOWN CUSTOMIZADO */}
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