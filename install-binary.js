// install-binary.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Tenta importar a lib
let YTDlpWrap;
try {
    YTDlpWrap = require('yt-dlp-wrap').default;
} catch (e) {
    console.error("❌ Erro: yt-dlp-wrap não instalado.");
    process.exit(1);
}

(async () => {
    console.log('⬇️  [SETUP] Iniciando download do binário yt-dlp...');
    
    // Define o nome do arquivo final
    const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const binaryPath = path.join(__dirname, binaryName);
    
    // Detecta a plataforma correta para o download do GitHub
    // No Railway (Linux), precisamos explicitamente pedir a versão 'linux'
    // para vir o binário standalone, e não o script python genérico.
    const platform = process.platform === 'win32' ? 'win32' : 'linux';

    try {
        // O 3º argumento força a plataforma correta
        await YTDlpWrap.downloadFromGithub(binaryPath, undefined, platform);
        console.log(`✅ [SETUP] Download concluído em: ${binaryPath}`);

        // No Linux (Railway), precisamos dar permissão de execução
        if (process.platform !== 'win32') {
            try {
                fs.chmodSync(binaryPath, '755');
                console.log('🔒 [SETUP] Permissão de execução (755) concedida.');
            } catch (err) {
                console.error('⚠️ [SETUP] Falha ao dar permissão via fs, tentando via shell...');
                execSync(`chmod +x ${binaryPath}`);
            }
        }
    } catch (error) {
        console.error('❌ [SETUP] Erro fatal ao baixar yt-dlp:', error);
        process.exit(1);
    }
})();