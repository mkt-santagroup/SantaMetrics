const { createClient } = require('@supabase/supabase-js');

// --- SUAS CREDENCIAIS AQUI ---
const SUPABASE_URL = 'SUA_URL_DO_SUPABASE';
const SUPABASE_KEY = 'SUA_CHAVE_SERVICE_ROLE';
const TOKEN_API_SANTA = 'Mjk5ODk4OiZTWk0zM1FxOGtaJDWA231XFXZ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const API_DAY_PLUS = 'http://api.santagroup.com.br:4957/get-day-plus-data?days=2';
const API_PLAYERS_INFO = 'http://api.santagroup.com.br:4957/get-players-info';

// ==================================================================
// 1. O CAÇADOR (Busca D+2 e cria chamados se necessário)
// ==================================================================
async function ingestLeads() {
    console.log('\n🏹 [CAÇADOR] Iniciando caçada...');
    
    try {
        // 1. Puxa a lista da API
        const response = await fetch(API_DAY_PLUS, {
            headers: { 'Authorization': TOKEN_API_SANTA, 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) throw new Error('Erro API DayPlus');
        
        const rawData = await response.json();
        const apiLeads = Array.isArray(rawData) ? rawData : [rawData];
        
        console.log(`🏹 Encontrados na API: ${apiLeads.length}`);
        
        if (apiLeads.length === 0) return;

        // 2. Para cada lead, verificamos se precisa criar um chamado novo
        let novosChamados = 0;

        for (const player of apiLeads) {
            
            // Verifica se JÁ EXISTE um chamado ABERTO (não recuperado) 
            // OU um chamado recente com a MESMA data de lastLogin (mesmo evento de abandono)
            const { data: existing } = await supabase
                .from('CALL_LEADS_D2')
                .select('id, last_login_at_ingestion')
                .eq('passport', player.passport)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            const apiLastLogin = new Date(player.lastLogin).getTime();
            
            let deveCriar = true;

            if (existing) {
                const dbLastLogin = new Date(existing.last_login_at_ingestion).getTime();
                
                // LÓGICA DE OURO:
                // Se a data de último login que veio da API for IGUAL a que já temos no banco,
                // significa que ele não logou desde a última vez que o capturamos.
                // É o mesmo abandono. Não criamos registro duplicado.
                if (apiLastLogin === dbLastLogin) {
                    deveCriar = false;
                }
            }

            if (deveCriar) {
                await supabase.from('CALL_LEADS_D2').insert({
                    passport: player.passport,
                    name: player.name || player.realName || 'Desconhecido',
                    whatsapp: player.whatsapp,
                    time_played: player.timePlayed,
                    first_spawn: player.firstspawn,
                    
                    // Aqui salvamos o "retrato" do momento
                    last_login_at_ingestion: player.lastLogin,
                    current_last_login: player.lastLogin,
                    
                    status: 'PENDING',
                    is_recovered: false
                });
                novosChamados++;
            }
        }

        console.log(`✅ [CAÇADOR] Processo fim. Novos chamados criados: ${novosChamados}`);

    } catch (err) {
        console.error('❌ Erro Caçador:', err);
    }
}

// ==================================================================
// 2. O VIGIA (Monitora APENAS quem não recuperou ainda)
// ==================================================================
async function checkRecovery() {
    console.log('\n👀 [VIGIA] Verificando recuperações...');

    // Pega só quem ainda está is_recovered = FALSE
    const { data: pendentes } = await supabase
        .from('CALL_LEADS_D2')
        .select('id, passport, last_login_at_ingestion')
        .eq('is_recovered', false);

    if (!pendentes || pendentes.length === 0) {
        console.log('👀 Ninguém para vigiar.');
        return;
    }

    // Extrai passports únicos para consultar a API (evita chamar 2x o mesmo passport se tiver duplicado por erro antigo)
    const passportsUnique = [...new Set(pendentes.map(p => p.passport))];
    
    try {
        const response = await fetch(API_PLAYERS_INFO, {
            method: 'POST',
            headers: { 'Authorization': TOKEN_API_SANTA, 'Content-Type': 'application/json' },
            body: JSON.stringify({ players: passportsUnique })
        });

        const infos = await response.json();
        let recoveredCount = 0;

        for (const info of infos) {
            // Pega todos os chamados abertos desse passport
            const chamadosDoPlayer = pendentes.filter(p => p.passport === info.passport);

            for (const chamado of chamadosDoPlayer) {
                const dataCaptura = new Date(chamado.last_login_at_ingestion).getTime();
                const dataAtual = new Date(info.lastLogin).getTime();

                // Se a data atual for MAIOR que a da captura => ELE LOGOU!
                if (dataAtual > dataCaptura) {
                    console.log(`🎉 RECUPERADO! Passport ${info.passport} (Chamado #${chamado.id})`);
                    
                    await supabase
                        .from('CALL_LEADS_D2')
                        .update({
                            is_recovered: true,
                            status: 'RECOVERED',
                            current_last_login: info.lastLogin, // Atualiza para mostrar quando ele voltou
                            updated_at: new Date()
                        })
                        .eq('id', chamado.id); // Fecha ESSE chamado específico
                    
                    recoveredCount++;
                }
            }
        }
        console.log(`✅ [VIGIA] ${recoveredCount} chamados marcados como recuperados.`);

    } catch (err) {
        console.error('❌ Erro Vigia:', err);
    }
}

// Roda tudo
async function start() {
    await ingestLeads();
    await checkRecovery();
    
    // Polling
    setInterval(ingestLeads, 30 * 60 * 1000); // Caçador a cada 30min
    setInterval(checkRecovery, 5 * 60 * 1000); // Vigia a cada 5min
}

start();