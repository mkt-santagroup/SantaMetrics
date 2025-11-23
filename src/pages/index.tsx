import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { Lock, ArrowRight, AlertCircle } from 'lucide-react';
import Head from 'next/head';
import styles from './Login.module.css';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const token = Cookies.get('santa_auth');
    if (token === 'logado') {
      router.push('/dashboard');
    }
  }, [router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // Limpa erro anterior

    // 1. Pega a senha do arquivo .env
    const envPassword = process.env.NEXT_PUBLIC_LOGIN_PASSWORD;

    // TRAVA DE SEGURANÇA 1: Se a variável não carregou, bloqueia tudo.
    if (!envPassword) {
      setError('ERRO CRÍTICO: Senha não configurada no servidor (.env).');
      return;
    }

    // TRAVA DE SEGURANÇA 2: Não aceita campo vazio
    if (!password || password.trim() === '') {
      setError('Digite a senha.');
      return;
    }

    // COMPARAÇÃO
    if (password === envPassword) {
      Cookies.set('santa_auth', 'logado', { expires: 1 });
      router.push('/dashboard');
    } else {
      setError('Senha incorreta.');
      // IMPORTANTE: NÃO limpamos mais o setPassword('') aqui para evitar o bug
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Acesso Restrito | SantaMetrics</title>
      </Head>

      <div className={styles.loginCard}>
        <div className={styles.iconWrapper}>
          <Lock size={40} strokeWidth={1.5} />
        </div>

        <h1 className={styles.title}>
          SantaMetrics
        </h1>
        <p className={styles.subtitle}>
          Área restrita. Digite sua credencial mestra para acessar o painel.
        </p>

        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Senha de Acesso</label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              className={`${styles.inputField} ${error ? styles.inputError : ''}`}
            />
            {error && (
              <span className={styles.errorMessage}>
                <AlertCircle size={16} /> {error}
              </span>
            )}
          </div>

          <button type="submit" className={styles.submitBtn}>
            Acessar Painel <ArrowRight size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}