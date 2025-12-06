export interface CallLeadD2 {
  id: number;
  passport: number;
  name: string | null;
  whatsapp: string | null;
  time_played: number | null;
  first_spawn: string | null;
  
  last_login_at_ingestion: string;
  current_last_login: string | null; // Pode ser nulo
  
  called_at: string | null;
  recovery_type: 'ORGANIC' | 'SAME_DAY' | 'LATE' | 'NONE' | null;
  
  status: 'PENDING' | 'CALLED' | 'RECOVERED' | 'FAILED';
  is_recovered: boolean;
  
  created_at: string;

  // --- NOVOS CAMPOS PARA CORRIGIR O ERRO ---
  call_count?: number; 
  call_history?: any[]; // Array de histórico (JSONB)
}