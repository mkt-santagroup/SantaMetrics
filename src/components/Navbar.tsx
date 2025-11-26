import styles from './Navbar.module.css'; 
import { LayoutDashboard, Users, LogOut, PhoneCall, Sun, Moon } from 'lucide-react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { useTheme } from '@/context/ThemeContext'; // <--- IMPORTAR

interface NavbarProps {
  currentTab: 'overview' | 'leads' | 'call';
  onTabChange: (tab: 'overview' | 'leads' | 'call') => void;
}

export default function Navbar({ currentTab, onTabChange }: NavbarProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme(); // <--- USAR HOOK

  const handleLogout = () => {
    Cookies.remove('santa_auth');
    router.push('/');
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.leftSection}>
        <div className={styles.logo}>
          <span className={styles.logoBold}>Santa</span>Metrics
        </div>
        
        <div className={styles.tabs}>
          {/* ... botões das abas (iguais) ... */}
          <button 
            className={`${styles.tab} ${currentTab === 'overview' ? styles.active : ''}`}
            onClick={() => onTabChange('overview')}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button 
            className={`${styles.tab} ${currentTab === 'leads' ? styles.active : ''}`}
            onClick={() => onTabChange('leads')}
          >
            <Users size={18} />
            Leads
          </button>
          <button 
            className={`${styles.tab} ${currentTab === 'call' ? styles.active : ''}`}
            onClick={() => onTabChange('call')}
          >
            <PhoneCall size={18} />
            Call Center
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {/* BOTÃO DE TEMA */}
        <button onClick={toggleTheme} className={styles.iconBtn} title="Alternar Tema">
          {theme === 'light' ? (
            <Moon size={20} className={styles.moonIcon} />
          ) : (
            <Sun size={20} className={styles.sunIcon} />
          )}
        </button>

        {/* BOTÃO SAIR */}
        <button onClick={handleLogout} className={`${styles.iconBtn} ${styles.logoutBtn}`} title="Sair">
          <LogOut size={20} />
        </button>
      </div>
    </nav>
  );
}