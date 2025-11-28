import { useState, useEffect, useRef } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/style.css'; // <--- MUDOU AQUI (na v9 é assim)
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import styles from './DateRangePicker.module.css';

export type DateFilterType = {
  label: string;
  from?: Date;
  to?: Date;
  value: 'today' | 'yesterday' | '7days' | '30days' | 'lifetime' | 'custom';
};

interface DateRangePickerProps {
  currentFilter: DateFilterType;
  onFilterChange: (filter: DateFilterType) => void;
}

export default function DateRangePicker({ currentFilter, onFilterChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePresetClick = (value: string) => {
    const today = new Date();
    let newFilter: DateFilterType = { label: '', value: value as any };

    switch (value) {
      case 'today':
        newFilter = { label: 'Hoje', value: 'today', from: startOfDay(today), to: endOfDay(today) };
        break;
      case 'yesterday':
        const yest = subDays(today, 1);
        newFilter = { label: 'Ontem', value: 'yesterday', from: startOfDay(yest), to: endOfDay(yest) };
        break;
      case '7days':
        newFilter = { label: 'Últimos 7 dias', value: '7days', from: subDays(today, 7), to: endOfDay(today) };
        break;
      case '30days':
        newFilter = { label: 'Últimos 30 dias', value: '30days', from: subDays(today, 30), to: endOfDay(today) };
        break;
      case 'lifetime':
        newFilter = { label: 'Todo o Período', value: 'lifetime', from: undefined, to: undefined };
        break;
    }

    onFilterChange(newFilter);
    setIsOpen(false);
    setSelectedRange(undefined); // Limpa seleção manual
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    setSelectedRange(range);
    if (range?.from && range?.to) {
      onFilterChange({
        label: `${format(range.from, 'dd/MM')} - ${format(range.to, 'dd/MM')}`,
        value: 'custom',
        from: range.from,
        to: range.to
      });
    }
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <button 
        className={`${styles.triggerBtn} ${isOpen ? styles.active : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <CalendarIcon size={16} className={styles.icon} />
        <span>{currentFilter.label}</span>
        <ChevronDown size={14} className={styles.chevron} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.presets}>
            <button onClick={() => handlePresetClick('today')} className={currentFilter.value === 'today' ? styles.presetActive : ''}>Hoje</button>
            <button onClick={() => handlePresetClick('yesterday')} className={currentFilter.value === 'yesterday' ? styles.presetActive : ''}>Ontem</button>
            <button onClick={() => handlePresetClick('7days')} className={currentFilter.value === '7days' ? styles.presetActive : ''}>7 dias</button>
            <button onClick={() => handlePresetClick('30days')} className={currentFilter.value === '30days' ? styles.presetActive : ''}>30 dias</button>
            <button onClick={() => handlePresetClick('lifetime')} className={currentFilter.value === 'lifetime' ? styles.presetActive : ''}>Lifetime</button>
          </div>
          
          <div className={styles.divider}></div>

          <div className={styles.calendarWrapper}>
            <DayPicker
              mode="range"
              selected={selectedRange}
              onSelect={handleRangeSelect}
              locale={ptBR}
              // Na v9, numberOfMonths é suportado nativamente, mas vamos manter simples
              // Se precisar de 2 meses, adicione: numberOfMonths={2}
              styles={{
                head_cell: { width: '40px', fontSize: '0.8rem', color: '#888' },
                cell: { width: '40px', height: '40px' },
                day: { width: '36px', height: '36px', fontSize: '0.9rem', borderRadius: '8px' },
              }}
              modifiersClassNames={{
                selected: styles.calendarSelected,
                today: styles.calendarToday
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}