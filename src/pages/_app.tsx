import '@/styles/globals.css'; // Mantenha seus estilos globais se tiver
import type { AppProps } from 'next/app';
import Head from 'next/head'; // <--- IMPORTANTE: O componente que controla o <head> do HTML

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        {/* TÍTULO DA ABA */}
        <title>SantaMetrics</title>
        
        {/* DESCRIÇÃO (Opcional, bom pro Google) */}
        <meta name="description" content="Dashboard de Leads Realtime SantaGroup" />
        
        {/* FAVICON (Sua logo na pasta public) */}
        {/* Certifique-se que o nome do arquivo aqui bate com o que você colocou na pasta public */}
        <link rel="icon" href="/santa-logo.png" type="image/png" />
        
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      {/* Aqui é onde sua página (Dashboard) é renderizada */}
      <Component {...pageProps} />
    </>
  );
}