import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { ThemeProvider } from '@/context/ThemeContext'; // <--- IMPORTANTE: O contexto que criamos

export default function App({ Component, pageProps }: AppProps) {
  // Substitua pelo seu link do Railway ou Vercel (sem a barra no final)
  const baseUrl = 'https://santametrics.up.railway.app'; 

  return (
    // O ThemeProvider PRECISA estar aqui, abraçando tudo
    <ThemeProvider>
      <Head>
        {/* --- TÍTULO E ÍCONE --- */}
        <title>SantaMetrics</title>
        <link rel="icon" href="/santa-logo.png" type="image/png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* --- DESCRIÇÃO PADRÃO (Para o Google) --- */}
        <meta name="description" content="Dashboard de gerenciamento de leads do SantaGroup." />

        {/* --- OPEN GRAPH (Para WhatsApp, Discord, Facebook) --- */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="SantaMetrics" />
        <meta property="og:description" content="Acesse o painel de controle de leads em tempo real." />
        <meta property="og:site_name" content="SantaMetrics" />
        
        {/* IMPORTANTE: O WhatsApp prefere links completos para imagens */}
        <meta property="og:image" content={`${baseUrl}/santa-logo.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* --- TWITTER CARD (Opcional, mas bom ter) --- */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SantaMetrics" />
        <meta name="twitter:description" content="Dashboard de gerenciamento de leads." />
        <meta name="twitter:image" content={`${baseUrl}/santa-logo.png`} />
      </Head>
      
      <Component {...pageProps} />
    </ThemeProvider>
  );
}