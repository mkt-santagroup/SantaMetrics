export interface Lead {
  id: number;
  nome: string | null;
  numero: string | null;
  spam: boolean | null;
  memoria_longa: string | null;
  etapa: string | null;
  observacoes: string | null;
  created_at: string;
  tem_pc: string | null; // <--- MUDOU PARA STRING
}