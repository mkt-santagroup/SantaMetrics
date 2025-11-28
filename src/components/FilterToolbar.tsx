// src/components/FilterToolbar.tsx
import { useState, useRef, useEffect } from 'react';
import { Search, Filter, Check, ArrowDownUp, Users, X } from 'lucide-react';
import styles from './FilterToolbar.module.css'; // Vamos criar o CSS abaixo
import { SortOption, PosLoginOption } from '@/hooks/useCallFilters';

interface FilterToolbarProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  sortOrder: SortOption;
  onSortChange: (val: SortOption) => void;
  posLoginFilter: PosLoginOption;
  onPosLoginChange: (val: PosLoginOption) => void;
}

export default function FilterToolbar({
  searchTerm, onSearchChange,
  sortOrder, onSortChange,
  posLoginFilter, onPosLoginChange
}: FilterToolbarProps) {
  
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Conta filtros ativos para mostrar bolinha vermelha se tiver filtro
  const activeCount = (posLoginFilter !== 'all' ? 1 : 0);

  return (
    <div className={styles.toolbarContainer}>
      
      {/* 1. BARRA DE BUSCA */}
      <div className={styles.searchWrapper}>
        <Search size={18} className={styles.searchIcon} />
        <input 
          type="text" 
          placeholder="Buscar por ID, Nome ou Telefone..." 
          className={styles.searchInput}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchTerm && (
          <button onClick={() => onSearchChange('')} className={styles.clearSearch}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* 2. BOTÃO FUNIL ÚNICO */}
      <div className={styles.filterWrapper} ref={menuRef}>
        <button 
          className={`${styles.filterTrigger} ${isOpen || activeCount > 0 ? styles.active : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Filter size={18} />
          <span>Filtros</span>
          {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
        </button>

        {/* MENU FLUTUANTE (DROPDOWN) */}
        {isOpen && (
          <div className={styles.dropdown}>
            
            {/* Seção: ORDENAÇÃO */}
            <div className={styles.section}>
              <span className={styles.sectionTitle}><ArrowDownUp size={14}/> Ordenar Por</span>
              <div className={styles.optionsGrid}>
                <button 
                  className={`${styles.optionBtn} ${sortOrder === 'newest' ? styles.selected : ''}`}
                  onClick={() => onSortChange('newest')}
                >
                  Mais Recentes
                </button>
                <button 
                  className={`${styles.optionBtn} ${sortOrder === 'oldest' ? styles.selected : ''}`}
                  onClick={() => onSortChange('oldest')}
                >
                  Mais Antigos
                </button>
              </div>
            </div>

            <div className={styles.divider}></div>

            {/* Seção: STATUS PÓS LOGIN */}
            <div className={styles.section}>
              <span className={styles.sectionTitle}><Users size={14}/> Status Pós Login</span>
              <div className={styles.optionsList}>
                <label className={styles.radioLabel}>
                  <input 
                    type="radio" 
                    name="posLogin" 
                    checked={posLoginFilter === 'all'} 
                    onChange={() => onPosLoginChange('all')}
                  />
                  Todos os Leads
                </label>
                <label className={styles.radioLabel}>
                  <input 
                    type="radio" 
                    name="posLogin" 
                    checked={posLoginFilter === 'yes'} 
                    onChange={() => onPosLoginChange('yes')}
                  />
                  <span style={{color: '#10b981', fontWeight: 600}}>Entraram (Sim)</span>
                </label>
                <label className={styles.radioLabel}>
                  <input 
                    type="radio" 
                    name="posLogin" 
                    checked={posLoginFilter === 'no'} 
                    onChange={() => onPosLoginChange('no')}
                  />
                  <span style={{color: '#ef4444', fontWeight: 600}}>Não Entraram (Não)</span>
                </label>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}