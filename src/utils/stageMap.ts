// src/utils/stageMap.ts

export const STAGE_DEFINITIONS: Record<string, string> = {
  '1': 'Boas-vindas',
  '2': 'Verificando se tem PC',
  '3': 'Link de tutorial enviado',
  '4': 'Comprar e Instalar o GTA',
  '5': 'Instalar o FiveM',
  '6': 'Confirmou abertura do FIVEM',
  '7': 'Entrar no Servidor',
  '8': 'Vinculando conta',
  '9': 'Configurar o Microfone',
  '10': 'Melhorar o Desempenho',
  '11': 'Melhorou o desempenho',
};

export function getStageName(rawStage: string | null): string {
  if (!rawStage) return 'Novo / Sem Etapa';

  // Tenta extrair apenas o número da string (Ex: "ETAPA 2" -> "2")
  const match = rawStage.match(/(\d+)/);
  
  if (match) {
    const number = match[0];
    // Retorna o nome bonito ou, se não achar, retorna o original formatado
    return STAGE_DEFINITIONS[number] || rawStage; 
  }

  return rawStage;
}