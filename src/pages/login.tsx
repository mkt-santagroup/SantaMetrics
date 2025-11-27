import { useState } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
// Import do CSS (mantendo o padrão minúsculo que corrigimos)
import styles from './login.module.css'; 
import { Lock, ArrowRight } from 'lucide-react';
import Head from 'next/head';

export default function Login() {
  const router = useRouter();
  
  // --- CONFIGURAÇÃO ---
  // Agora lê a variável de ambiente que começa com NEXT_PUBLIC_
  const SENHA_CORRETA = process.env.NEXT_PUBLIC_LOGIN_PASSWORD; 
  
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simula um pequeno delay para parecer processamento real
    setTimeout(() => {
      // Verifica se a senha digitada bate com a do .env
      // O trim() remove espaços acidentais antes ou depois
      if (password === SENHA_CORRETA) {
        // Sucesso: Define o cookie e redireciona
        Cookies.set('santa_auth', 'logado', { expires: 7 }); 
        router.push('/');
      } else {
        // Erro: Senha incorreta
        setError('Senha incorreta. Tente novamente.');
        setLoading(false);
        setPassword(''); // Limpa o campo
      }
    }, 800);
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Login | SantaMetrics</title>
      </Head>

      <div className={styles.loginCard}>
        <div className={styles.iconWrapper}>
          <Lock size={32} />
        </div>

        <h1 className={styles.title}>Acesso Restrito</h1>
        <p className={styles.subtitle}>
          Insira sua senha de administrador<br />
          para acessar o painel.
        </p>

        <form onSubmit={handleLogin} className={styles.form}>
          
          <div className={styles.inputGroup}>
            <span className={styles.inputLabel}>SENHA DE ACESSO</span>
            <input 
              type="password" 
              className={`${styles.inputField} ${error ? styles.inputError : ''}`}
              placeholder="Digite a senha..."
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(''); 
              }}
            />
            {error && (
              <span className={styles.errorMessage}>{error}</span>
            )}
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading || !password}>
            {loading ? 'Verificando...' : 'Entrar'}
            {!loading && <ArrowRight size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
}