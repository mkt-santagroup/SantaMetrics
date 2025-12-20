// src/types/leads.ts
export interface Lead {
  id: number;
  created_at: string;
  nome: string | null;
  numero: string | null;
  etapa: string | null;
  tem_pc: string | null;
  observacoes: string | null;
  spam?: boolean;
}