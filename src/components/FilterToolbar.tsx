// src/components/FilterToolbar.tsx
import { useState, useRef, useEffect } from 'react';
import { Search, Filter, ArrowDownUp, Users, X, Phone, ChevronDown, Check } from 'lucide-react';
import styles from './FilterToolbar.module.css';
import { SortKey, SortDirection, PosLoginOption } from '@/hooks/useCallFilters';
import { STATUS_CONFIG, CALL_STATUS_OPTIONS } from '@/utils/callStatusColors';

// --- CUSTOM PICKER ---
interface CustomPickerProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
}

function CustomPicker({ value, onChange, options }: CustomPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectedConfig = STATUS_CONFIG[value];
  const DisplayIcon = selectedConfig?.icon;

  return (
    <div className={styles.pickerContainer} ref={containerRef}>
      <div 
        className={`${styles.pickerTrigger} ${isOpen ? styles.isOpen : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Mostra ícone se não for 'all' */}
          {value !== 'all' && DisplayIcon && (
            <span style={{ color: selectedConfig.color }}><DisplayIcon size={16} /></span>
          )}
          <span>{value === 'all' ? 'Todos os Status' : (STATUS_CONFIG[value]?.label || value)}</span>
        </div>
        <ChevronDown size={16} style={{ opacity: 0.5, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
      </div>

      {isOpen && (
        <div className={styles.pickerMenu}>
          <div 
            className={`${styles.pickerOption} ${value === 'all' ? styles.pickerOptionSelected : ''}`}
            onClick={() => { onChange('all'); setIsOpen(false); }}
          >
            <div className={styles.pickerIcon}><Check size={14} style={{ opacity: value === 'all' ? 1 : 0 }} /></div>
            <span style={{flex:1}}>Todos os Status</span>
          </div>
          
          {options.map((status) => {
            const config = STATUS_CONFIG[status];
            const Icon = config?.icon;
            const isSelected = value === status;

            return (
              <div 
                key={status} 
                className={`${styles.pickerOption} ${isSelected ? styles.pickerOptionSelected : ''}`}
                onClick={() => { onChange(status); setIsOpen(false); }}
              >
                <div className={styles.pickerIcon} style={{ color: isSelected ? 'inherit' : (config?.color || '#888') }}>
                  {Icon && <Icon size={16} />}
                </div>
                <span style={{ flex: 1 }}>{config?.label || status}</span>
                {isSelected && <Check size={14} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

  call1StatusFilter: string;
  onCall1StatusChange: (val: string) => void;

  call2StatusFilter: string;
  onCall2StatusChange: (val: string) => void;

  onReset: () => void;
}

export default function FilterToolbar({
  searchTerm, onSearchChange,
  sortKey, onSortKeyChange,
  sortDirection, onSortDirectionChange,
  posLoginFilter, onPosLoginChange,
  call1StatusFilter, onCall1StatusChange,
  call2StatusFilter, onCall2StatusChange,
  onReset
}: FilterToolbarProps) {
  
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<'bottom' | 'top'>('bottom'); // Estado da posição
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
  if (call1StatusFilter !== 'all') activeCount++;
  if (call2StatusFilter !== 'all') activeCount++;

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
                <RenderSortOption label="1ª Ligação" sKey="call1_hour" />
                <RenderSortOption label="2ª Ligação" sKey="call2_hour" />
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

            <div className={styles.section}>
              <span className={styles.sectionTitle}><Phone size={14}/> Status 1ª Ligação</span>
              <CustomPicker 
                value={call1StatusFilter} 
                onChange={onCall1StatusChange} 
                options={CALL_STATUS_OPTIONS} 
              />
            </div>

            <div className={styles.section}>
              <span className={styles.sectionTitle}><Phone size={14}/> Status 2ª Ligação</span>
              <CustomPicker 
                value={call2StatusFilter} 
                onChange={onCall2StatusChange} 
                options={CALL_STATUS_OPTIONS} 
              />
            </div>

          </div>
        )}
      </div>
    </div>
  );
}