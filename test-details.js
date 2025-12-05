// test-details.js
const API_URL = 'http://api.santagroup.com.br:4957/get-players-info';
const TOKEN = 'Mjk5ODk4OiZTWk0zM1FxOGtaJDWA231XFXZ';

// Peguei este ID do seu print anterior ("passport": 50554)
const PLAYER_IDS = [50554]; 

async function fetchPlayerDetails() {
  try {
    console.log(`🔌 Consultando detalhes para o player: ${PLAYER_IDS}...`);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': TOKEN,
        'Content-Type': 'application/json'
      },
      // A API espera um array de IDs no corpo
      body: JSON.stringify({ players: PLAYER_IDS })
    });

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    console.log('✅ Detalhes recebidos com sucesso!');
    console.log('--- RESPOSTA DA API (DETALHES) ---');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ Falha na requisição:', error.message);
  }
}

fetchPlayerDetails();