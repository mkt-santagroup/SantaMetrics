// test-api.js
const API_URL = 'http://api.santagroup.com.br:4957/get-day-plus-data';
const TOKEN = 'Mjk5ODk4OiZTWk0zM1FxOGtaJDWA231XFXZ';

async function fetchDayPlusData() {
  try {
    console.log(`🔌 Conectando a: ${API_URL}...`);

    // O parâmetro 'days=2' refere-se ao seu critério D+2
    const response = await fetch(`${API_URL}?days=2`, {
      method: 'GET',
      headers: {
        'Authorization': TOKEN,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    console.log('✅ Dados recebidos com sucesso!');
    
    // Verifica se é um array e pega o primeiro item, ou mostra o objeto inteiro se for único
    if (Array.isArray(data)) {
      console.log(`Total de registros encontrados: ${data.length}`);
      console.log('--- ESTRUTURA DO PRIMEIRO ITEM ---');
      console.log(JSON.stringify(data[0], null, 2)); 
    } else {
      console.log('--- ESTRUTURA DOS DADOS ---');
      console.log(JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('❌ Falha na requisição:', error.message);
  }
}

fetchDayPlusData();