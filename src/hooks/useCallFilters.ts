// src/hooks/useCallFilters.ts
import { useState, useMemo } from 'react';
import { CallLead } from '@/types/callLeads';
import { parseISO, compareAsc, compareDesc } from 'date-fns';

export type SortKey = 'created_at' | 'Last_login' | 'pos_login_static' | 'call1_hour' | 'call2_hour' | 'Tempo_de_jogo';
export type SortDirection = 'asc' | 'desc';
export type PosLoginOption = 'all' | 'yes' | 'no';

export function useCallFilters(data: CallLead[]) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [posLoginFilter, setPosLoginFilter] = useState<PosLoginOption>('all');
  const [call1StatusFilter, setCall1StatusFilter] = useState<string>('all');
  const [call2StatusFilter, setCall2StatusFilter] = useState<string>('all');

  // --- NOVA FUNÇÃO DE RESET ---
  const resetFilters = () => {
    setSearchTerm('');
    setSortKey('created_at');
    setSortDirection('desc');
    setPosLoginFilter('all');
    setCall1StatusFilter('all');
    setCall2StatusFilter('all');
  };

  const filteredData = useMemo(() => {
    let result = [...data];

    // 1. Busca Texto
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.ID?.toString().includes(lower) ||
        item.nome?.toLowerCase().includes(lower) ||
        item.whatsapp?.includes(lower)
      );
    }

    // 2. Filtro Pós Login
    if (posLoginFilter !== 'all') {
      result = result.filter(item => {
        if (posLoginFilter === 'yes') return !!item.pos_login_static;
        if (posLoginFilter === 'no') return !item.pos_login_static;
        return true;
      });
    }

    // --- CORREÇÃO DO BUG AQUI ---
    // Normalizamos para UpperCase e Trim para garantir que "SENT" bata com "SENT"
    
    // 3. Filtro Status Call 1
    if (call1StatusFilter !== 'all') {
      result = result.filter(item => {
        const s = item.call1_status ? item.call1_status.trim().toUpperCase() : 'UNKNOWN';
        return s === call1StatusFilter.trim().toUpperCase();
      });
    }

    // 4. Filtro Status Call 2
    if (call2StatusFilter !== 'all') {
      result = result.filter(item => {
        const s = item.call2_status ? item.call2_status.trim().toUpperCase() : 'UNKNOWN';
        return s === call2StatusFilter.trim().toUpperCase();
      });
    }

    // 5. Ordenação
    result.sort((a, b) => {
      let valA: any = a[sortKey];
      let valB: any = b[sortKey];

      if (sortKey === 'Tempo_de_jogo') {
        valA = valA || 0;
        valB = valB || 0;
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const dateA = valA ? parseISO(valA) : new Date(0);
      const dateB = valB ? parseISO(valB) : new Date(0);

      if (sortDirection === 'desc') return compareDesc(dateA, dateB);
      return compareAsc(dateA, dateB);
    });

    return result;
  }, [data, searchTerm, sortKey, sortDirection, posLoginFilter, call1StatusFilter, call2StatusFilter]);

  return {
    searchTerm, setSearchTerm,
    sortKey, setSortKey,
    sortDirection, setSortDirection,
    posLoginFilter, setPosLoginFilter,
    call1StatusFilter, setCall1StatusFilter,
    call2StatusFilter, setCall2StatusFilter,
    resetFilters, // Exporta a função
    filteredData
  };
}