export interface CallLead {
  ID: number;
  First_login: string | null;
  Last_login: string | null;
  Tempo_de_jogo: number | null;
  nome: string | null;
  whatsapp: string | null;
  login_no_dia: boolean | null;
  
  // Booleanos (mantive caso precise pra lógica, mas a tabela vai usar os status abaixo)
  call_1: boolean | null;
  call_2: boolean | null;
  
  // Lógica de tentativas (que fizemos antes)
  called: boolean | null;
  called2: boolean | null;
  called3: boolean | null;
  called4: boolean | null;

  sms1: string | null;
  sms2: string | null;
  created_at: string | null;

  // --- NOVOS CAMPOS DE STATUS (TEXTO) ---
  call1_status: string | null;
  call2_status: string | null;
}