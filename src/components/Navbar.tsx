import styles from './Navbar.module.css'; // <--- O NOME DEVE SER EXATO
import { Users, LogOut, Sun, Moon, Eye } from 'lucide-react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { useTheme } from '@/context/ThemeContext';

interface NavbarProps {
  currentTab: 'leads' | 'views';
  onTabChange: (tab: 'leads' | 'views') => void;
}

export default function Navbar({ currentTab, onTabChange }: NavbarProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => {
    Cookies.remove('santa_auth');
    router.push('/login');
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.leftSection}>
        {/* Logo */}
        <div className={styles.logo}>
          <span className={styles.logoBold}>Santa</span>Metrics
        </div>
        
        {/* Abas de Navegação */}
        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${currentTab === 'leads' ? styles.active : ''}`}
            onClick={() => onTabChange('leads')}
          >
            <Users size={18} />
            <span className={styles.tabText}>Whatsapp</span>
          </button>

          <button 
            className={`${styles.tab} ${currentTab === 'views' ? styles.active : ''}`}
            onClick={() => onTabChange('views')}
          >
            <Eye size={18} />
            <span className={styles.tabText}>Views</span>
          </button>
        </div>
      </div>

      {/* Botões da Direita (Tema e Logout) */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button onClick={toggleTheme} className={styles.iconBtn} title="Alternar Tema">
          {theme === 'light' ? (
            <Moon size={20} className={styles.moonIcon} />
          ) : (
            <Sun size={20} className={styles.sunIcon} />
          )}
        </button>

        <button onClick={handleLogout} className={`${styles.iconBtn} ${styles.logoutBtn}`} title="Sair">
          <LogOut size={20} />
        </button>
      </div>
    </nav>
  );
}