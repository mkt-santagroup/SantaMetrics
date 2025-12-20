import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Verifica se tem o cookie de autenticação
    const token = Cookies.get('santa_auth');

    if (token === 'logado') {
      // Manda direto para o Dashboard (que já arrumamos)
      router.replace('/dashboard');
    } else {
      // Se não, manda pro Login
      router.replace('/login');
    }
  }, [router]);

  return null; 
}