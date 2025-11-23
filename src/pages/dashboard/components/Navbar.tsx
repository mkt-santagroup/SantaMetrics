import styles from './Navbar.module.css';
import { LayoutDashboard, Users } from 'lucide-react';

interface NavbarProps {
  currentTab: 'overview' | 'leads';
  onTabChange: (tab: 'overview' | 'leads') => void;
}

export default function Navbar({ currentTab, onTabChange }: NavbarProps) {
  return (
    <nav className={styles.navbar}>
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
          Leads - WhatsApp
        </button>
      </div>
    </nav>
  );
}