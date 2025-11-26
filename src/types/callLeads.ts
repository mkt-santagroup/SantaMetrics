export interface CallLead {
  ID: number;
  First_login: string | null;
  Last_login: string | null;
  Tempo_de_jogo: number | null;
  nome: string | null;
  whatsapp: string | null;
  login_no_dia: boolean | null;
  call_1: boolean | null;
  call_2: boolean | null;
  sms1: string | null;
  sms2: string | null;
  created_at: string | null; // <--- NOVO CAMPO
}