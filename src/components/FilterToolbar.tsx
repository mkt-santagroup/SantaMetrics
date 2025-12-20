import { useState, useRef, useEffect } from 'react';
import { Search, Filter, ArrowDownUp, Users, X, Check } from 'lucide-react';
import styles from './FilterToolbar.module.css';
import { Lead } from '@/types/leads'; // Ajuste conforme seus tipos, se necessário

// Definição local de tipos se não estiverem globais
type SortDirection = 'asc' | 'desc';
type SortKey = 'created_at' | 'Last_login' | 'pos_login_static' | 'Tempo_de_jogo'; // Removido call1/call2
type PosLoginOption = 'all' | 'yes' | 'no';

// --- COMPONENTE PRINCIPAL ---
interface FilterToolbarProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  
  sortKey: SortKey;
  onSortKeyChange: (val: SortKey) => void;
  sortDirection: SortDirection;
  onSortDirectionChange: (val: SortDirection) => void;

  posLoginFilter: PosLoginOption;
  onPosLoginChange: (val: PosLoginOption) => void;

  onReset: () => void;
}

export default function FilterToolbar({
  searchTerm, onSearchChange,
  sortKey, onSortKeyChange,
  sortDirection, onSortDirectionChange,
  posLoginFilter, onPosLoginChange,
  onReset
}: FilterToolbarProps) {
  
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<'bottom' | 'top'>('bottom');
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && 
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Lógica de Detecção de Posição
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      
      // Se tiver menos de 500px em baixo, abre pra cima
      if (spaceBelow < 500) {
        setPosition('top');
      } else {
        setPosition('bottom');
      }
    }
  }, [isOpen]);

  let activeCount = 0;
  if (posLoginFilter !== 'all') activeCount++;

  const RenderSortOption = ({ label, sKey }: { label: string, sKey: SortKey }) => {
    const isSelected = sortKey === sKey;
    return (
      <div className={styles.sortRow}>
        <span className={styles.sortLabel}>{label}</span>
        <div className={styles.sortButtons}>
          <button 
            className={`${styles.miniBtn} ${isSelected && sortDirection === 'desc' ? styles.selected : ''}`}
            onClick={() => { onSortKeyChange(sKey); onSortDirectionChange('desc'); }}
          >
            {sKey === 'Tempo_de_jogo' ? 'Maior' : 'Recente'}
          </button>
          <button 
            className={`${styles.miniBtn} ${isSelected && sortDirection === 'asc' ? styles.selected : ''}`}
            onClick={() => { onSortKeyChange(sKey); onSortDirectionChange('asc'); }}
          >
            {sKey === 'Tempo_de_jogo' ? 'Menor' : 'Antigo'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.toolbarContainer}>
      <div className={styles.searchWrapper}>
        <Search size={18} className={styles.searchIcon} />
        <input 
          type="text" 
          placeholder="Buscar ID, Nome ou Telefone..." 
          className={styles.searchInput}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchTerm && <button onClick={() => onSearchChange('')} className={styles.clearSearch}><X size={14} /></button>}
      </div>

      <div className={styles.filterWrapper}>
        <button 
          ref={buttonRef}
          className={`${styles.filterTrigger} ${isOpen || activeCount > 0 ? styles.active : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Filter size={18} />
          <span>Filtros</span>
          {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
        </button>

        {isOpen && (
          <div 
            className={`${styles.dropdown} ${position === 'top' ? styles.dropdownTop : styles.dropdownBottom}`} 
            ref={menuRef}
          >
            <div className={styles.dropdownHeader}>
              <span className={styles.headerTitle}>Filtros & Ordenação</span>
              <button className={styles.clearBtn} onClick={onReset}>
                Limpar Tudo
              </button>
            </div>
            
            <div className={styles.section}>
              <span className={styles.sectionTitle}><ArrowDownUp size={14}/> Ordenar Por</span>
              <div className={styles.sortList}>
                <RenderSortOption label="Data de Criação" sKey="created_at" />
                <RenderSortOption label="Último Login" sKey="Last_login" />
                <RenderSortOption label="Entrada Pós" sKey="pos_login_static" />
                <RenderSortOption label="Tempo de Jogo" sKey="Tempo_de_jogo" />
              </div>
            </div>

            <div className={styles.section}>
              <span className={styles.sectionTitle}><Users size={14}/> Status Pós Login</span>
              <div className={styles.optionsGrid3}>
                {['all', 'yes', 'no'].map((opt) => (
                  <button 
                    key={opt}
                    className={`${styles.filterBtn} ${posLoginFilter === opt ? styles.filterSelected : ''}`}
                    onClick={() => onPosLoginChange(opt as PosLoginOption)}
                  >
                    {opt === 'all' ? 'Todos' : opt === 'yes' ? 'Entraram' : 'Não Entr.'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}