export interface CallLead {
  ID: number;
  First_login: string | null;
  Last_login: string | null;
  Tempo_de_jogo: number | null;
  nome: string | null;
  whatsapp: string | null;
  login_no_dia: boolean | null;
  
  // Booleanos antigos
  call_1: boolean | null;
  call_2: boolean | null;
  
  // Tentativas
  called: boolean | null;
  called2: boolean | null;
  called3: boolean | null;
  called4: boolean | null;

  sms1: string | null;
  sms2: string | null;
  created_at: string | null;

  // Status de texto
  call1_status: string | null;
  call2_status: string | null;

  last_login_static: string | null; // O snapshot do login original
  pos_login_static: string | null;  // A data que confirmou o login pós call

  // --- NOVOS CAMPOS DE HORA ---
  call1_hour: string | null;
  call2_hour: string | null;
}