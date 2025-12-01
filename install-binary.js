// install-binary.js
const YTDlpWrap = require('yt-dlp-wrap').default;
const fs = require('fs');
const path = require('path');

(async () => {
    console.log('⬇️  Iniciando download do binário yt-dlp...');
    
    try {
        // Baixa o binário oficial mais recente do GitHub e salva na raiz
        await YTDlpWrap.downloadFromGithub();
        console.log('✅ Download concluído!');

        // No Linux (Railway), precisamos dar permissão de execução
        if (process.platform !== 'win32') {
            const binaryPath = path.join(__dirname, 'yt-dlp');
            if (fs.existsSync(binaryPath)) {
                fs.chmodSync(binaryPath, '755');
                console.log('🔒 Permissão de execução concedida (755).');
            }
        }
    } catch (error) {
        console.error('❌ Erro ao baixar yt-dlp:', error);
        process.exit(1);
    }
})();