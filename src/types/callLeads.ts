// src/types/callLeads.ts

export interface CallLead {
  ID: number;
  First_login: string | null;
  Last_login: string | null;
  Tempo_de_jogo: number | null;
  nome: string | null;
  whatsapp: string | null;
  login_no_dia: boolean | null;
  
  // Booleanos de controle de atendimento/processamento
  call_1: boolean | null;
  call_2: boolean | null;
  
  // Tentativas (Flags de disparo)
  called: boolean | null;
  called2: boolean | null;
  called3: boolean | null;
  called4: boolean | null;

  sms1: string | null;
  sms2: string | null;
  created_at: string | null;

  // Status de texto do SIP
  call1_status: string | null;
  call2_status: string | null;

  // Datas de disparo
  call1_hour: string | null;
  call2_hour: string | null;

  // Snapshots de conversão (Campos calculados)
  pos_login_static: string | null;  // Data que confirmou o login pós call
  last_login_static: string | null; // O snapshot do login antes da call

  // --- NOVO CAMPO DO SCHEMA ---
  call_count: number | null;
}