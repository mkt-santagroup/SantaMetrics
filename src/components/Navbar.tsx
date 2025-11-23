// CORREÇÃO AQUI: Import relativo (./) pois estão na mesma pasta agora
import styles from './Navbar.module.css'; 
import { LayoutDashboard, Users, LogOut } from 'lucide-react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';

interface NavbarProps {
  currentTab: 'overview' | 'leads';
  onTabChange: (tab: 'overview' | 'leads') => void;
}

export default function Navbar({ currentTab, onTabChange }: NavbarProps) {
  const router = useRouter();

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
        </div>
      </div>

      <button onClick={handleLogout} className={styles.logoutBtn} title="Sair do sistema">
        <LogOut size={20} />
      </button>
    </nav>
  );
}