// src/hooks/useCallFilters.ts

export type SortKey = 
  | 'created_at' 
  | 'Last_login' 
  | 'pos_login_static' 
  | 'call1_hour' 
  | 'call2_hour' 
  | 'Tempo_de_jogo';

export type SortDirection = 'asc' | 'desc';

export type PosLoginOption = 'all' | 'yes' | 'no';

// Se você tiver lógica de hook aqui, pode manter. 
// Se esse arquivo servia apenas para tipos, o conteúdo acima basta para o build passar.