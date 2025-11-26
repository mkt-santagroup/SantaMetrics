import { useState, useMemo, useEffect } from 'react';
import { CallLead } from '@/types/callLeads';
import { format, isSameDay, subDays, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import styles from './LeadsTable.module.css';
import { 
  CheckCircle, XCircle, Clock, Search, 
  ChevronLeft, ChevronRight, Filter 
} from 'lucide-react';

interface CallLeadsTableProps {
  data: CallLead[];
  dateFilter: string; // <--- RECEBE O FILTRO DE DATA DO PAI
}

export default function CallLeadsTable({ data, dateFilter }: CallLeadsTableProps) {
  
  // --- ESTADOS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // <--- NOVO ESTADO PARA SELETOR

  // --- 1. LÓGICA DE FILTRAGEM (Data + Texto + Status) ---
  const filteredData = useMemo(() => {
    const today = new Date();

    return data.filter((item) => {
      // A. FILTRO DE DATA (usando created_at ou Last_login como fallback)
      // Se quiser filtrar por "data de criação do lead", use created_at.
      // Se quiser por "atividade", use Last_login. Vou usar created_at conforme pedido.
      const dateToCheck = item.created_at ? new Date(item.created_at) : null;
      
      let matchesDate = true;
      if (dateToCheck) {
        if (dateFilter === 'today') matchesDate = isSameDay(dateToCheck, today);
        else if (dateFilter === 'yesterday') matchesDate = isSameDay(dateToCheck, subDays(today, 1));
        else if (dateFilter === '7days') matchesDate = isAfter(dateToCheck, subDays(today, 7));
        else if (dateFilter === '30days') matchesDate = isAfter(dateToCheck, subDays(today, 30));
      } 
      // Se for 'lifetime' ou sem data, passa direto (ou ajusta conforme regra de negócio)
      if (dateFilter !== 'lifetime' && !dateToCheck) matchesDate = false; 

      if (!matchesDate) return false;

      // B. FILTRO DE TEXTO
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        item.ID.toString().includes(searchLower) ||
        (item.nome && item.nome.toLowerCase().includes(searchLower)) ||
        (item.whatsapp && item.whatsapp.includes(searchLower));

      // C. FILTRO DE STATUS
      let matchesStatus = true;
      if (statusFilter === 'online') matchesStatus = item.login_no_dia === true;
      else if (statusFilter === 'offline') matchesStatus = item.login_no_dia === false || item.login_no_dia === null;

      return matchesSearch && matchesStatus;
    });
  }, [data, searchTerm, statusFilter, dateFilter]); // Adicionado dateFilter na dependência

  // Resetar página ao filtrar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFilter, itemsPerPage]);

  // --- 2. PAGINAÇÃO ---
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);


  // --- FORMATADORES ---
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

  return (
    <div className={styles.tableContainer}>
      
      {/* BARRA DE FERRAMENTAS */}
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

      {/* TABELA */}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Nome / WhatsApp</th>
            <th>Tempo Jogo</th>
            <th>Login Hoje?</th>
            <th>Call 1</th>
            <th>Call 2</th>
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
              <td><BooleanBadge value={item.call_1} /></td>
              <td><BooleanBadge value={item.call_2} /></td>
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

      {/* PAGINAÇÃO E SELETOR DE QTD */}
      {filteredData.length > 0 && (
        <div className={styles.pagination}>
          
          <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
            <span className={styles.pageInfo}>
              Mostrando <b>{paginatedData.length}</b> de <b>{filteredData.length}</b>
            </span>
            
            {/* SELETOR DE ITENS POR PÁGINA (NOVO) */}
            <select 
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-page)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value={10}>10 por pág</option>
              <option value={20}>20 por pág</option>
              <option value={30}>30 por pág</option>
              <option value={50}>50 por pág</option>
              <option value={100}>100 por pág</option>
            </select>
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