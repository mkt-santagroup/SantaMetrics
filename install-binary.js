// install-binary.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Tenta importar a lib. Se falhar, não crasha o build, mas avisa.
let YTDlpWrap;
try {
    YTDlpWrap = require('yt-dlp-wrap').default;
} catch (e) {
    console.error("❌ Erro: yt-dlp-wrap não instalado. O 'npm install' rodou?");
    process.exit(1);
}

(async () => {
    console.log('⬇️  [SETUP] Iniciando download do binário yt-dlp...');
    
    // Define o nome do arquivo final
    const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const binaryPath = path.join(__dirname, binaryName);

    try {
        // Baixa o binário oficial mais recente do GitHub
        await YTDlpWrap.downloadFromGithub(binaryPath);
        console.log(`✅ [SETUP] Download concluído em: ${binaryPath}`);

        // No Linux (Railway), precisamos dar permissão de execução (chmod +x)
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