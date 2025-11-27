import styles from './Navbar.module.css'; 
import { Users, LogOut, PhoneCall, Sun, Moon } from 'lucide-react'; // Removi LayoutDashboard
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { useTheme } from '@/context/ThemeContext';

// Ajustei a tipagem para aceitar apenas 'leads' ou 'call'
interface NavbarProps {
  currentTab: 'leads' | 'call';
  onTabChange: (tab: 'leads' | 'call') => void;
}

export default function Navbar({ currentTab, onTabChange }: NavbarProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

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
          {/* ABA UNIFICADA: Leads & Dashboard */}
          <button 
            className={`${styles.tab} ${currentTab === 'leads' ? styles.active : ''}`}
            onClick={() => onTabChange('leads')}
          >
            <Users size={18} />
            Whatsapp
          </button>

          {/* ABA CALL CENTER */}
          <button 
            className={`${styles.tab} ${currentTab === 'call' ? styles.active : ''}`}
            onClick={() => onTabChange('call')}
          >
            <PhoneCall size={18} />
            Ligações
          </button>
        </div>
      </div>

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