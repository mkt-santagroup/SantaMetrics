// src/types/callLeads.ts

export interface CallLead {
  ID: number;
  First_login: string | null;
  Last_login: string | null;
  Tempo_de_jogo: number | null;
  nome: string | null;
  whatsapp: string | null;
  login_no_dia: boolean | null;
  
  // Booleanos de controle
  call_1: boolean | null;
  call_2: boolean | null;
  
  // Tentativas
  called: boolean | null;
  called2: boolean | null;
  called3: boolean | null;
  called4: boolean | null;

  // --- NOVOS CAMPOS DE CUSTO ---
  // Aceita string ("0.15") ou number, caso o banco mude
  call1_custo: string | number | null;
  call2_custo: string | number | null;
  call3_custo: string | number | null;
  call4_custo: string | number | null;

  sms1: string | null;
  sms2: string | null;
  created_at: string | null;

  call1_status: string | null;
  call2_status: string | null;

  call1_hour: string | null;
  call2_hour: string | null;

  pos_login_static: string | null;
  last_login_static: string | null;

  call_count: number | null;
}