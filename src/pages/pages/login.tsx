import { useState } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
// AJUSTE AQUI: Importando com letras minúsculas para garantir compatibilidade
import styles from './login.module.css'; 
import { Lock, ArrowRight } from 'lucide-react';
import Head from 'next/head';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulação de Login simples
    if (password) {
      // Define o cookie que o index.tsx verifica
      Cookies.set('santa_auth', 'logado', { expires: 7 }); 
      
      // Redireciona para o dashboard
      router.push('/');
    } else {
      setError('Por favor, preencha a senha.');
      setLoading(false);
    }
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

        <h1 className={styles.title}>Bem-vindo de volta</h1>
        <p className={styles.subtitle}>
          Insira suas credenciais para acessar<br />
          o painel SantaMetrics.
        </p>

        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.inputGroup}>
            <span className={styles.inputLabel}>Usuário</span>
            <input 
              type="text" 
              className={`${styles.inputField} ${error ? styles.inputError : ''}`}
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className={styles.inputGroup}>
            <span className={styles.inputLabel}>Senha</span>
            <input 
              type="password" 
              className={`${styles.inputField} ${error ? styles.inputError : ''}`}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <span className={styles.errorMessage}>{error}</span>
            )}
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Entrando...' : 'Acessar Painel'}
            {!loading && <ArrowRight size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
}