import styles from './StatCard.module.css';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
}

export default function StatCard({ title, value, icon: Icon }: StatCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <Icon size={20} className={styles.icon} />
      </div>
      <div className={styles.value}>{value}</div>
    </div>
  );
}