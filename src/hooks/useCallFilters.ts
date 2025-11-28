// src/hooks/useCallFilters.ts
import { useState, useMemo } from 'react';
import { CallLead } from '@/types/callLeads';
import { parseISO, compareAsc, compareDesc } from 'date-fns';

export type SortOption = 'newest' | 'oldest';
export type PosLoginOption = 'all' | 'yes' | 'no' | 'before';

export function useCallFilters(data: CallLead[]) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados do Filtro Único
  const [sortOrder, setSortOrder] = useState<SortOption>('newest');
  const [posLoginFilter, setPosLoginFilter] = useState<PosLoginOption>('all');
  const [statusFilter, setStatusFilter] = useState<string[]>([]); // Para status específicos se precisar

  const filteredData = useMemo(() => {
    let result = [...data];

    // 1. Busca Texto (ID, Nome, Zap)
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.ID?.toString().includes(lower) ||
        item.nome?.toLowerCase().includes(lower) ||
        item.whatsapp?.includes(lower)
      );
    }

    // 2. Filtro Pós Login (Entraram / Não Entraram)
    if (posLoginFilter !== 'all') {
      result = result.filter(item => {
        if (posLoginFilter === 'yes') return !!item.pos_login_static; // Tem data = Entrou
        if (posLoginFilter === 'no') return !item.pos_login_static;   // Sem data = Não entrou
        return true;
      });
    }

    // 3. Ordenação (Mais Recente / Mais Antigo)
    result.sort((a, b) => {
      const dateA = a.created_at ? parseISO(a.created_at) : new Date(0);
      const dateB = b.created_at ? parseISO(b.created_at) : new Date(0);
      
      if (sortOrder === 'newest') return compareDesc(dateA, dateB); // Do maior pro menor
      if (sortOrder === 'oldest') return compareAsc(dateA, dateB);  // Do menor pro maior
      return 0;
    });

    return result;
  }, [data, searchTerm, sortOrder, posLoginFilter, statusFilter]);

  return {
    searchTerm, setSearchTerm,
    sortOrder, setSortOrder,
    posLoginFilter, setPosLoginFilter,
    statusFilter, setStatusFilter,
    filteredData
  };
}