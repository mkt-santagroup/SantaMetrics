import { Phone, PhoneOff, AlertCircle, Send, XCircle, Activity, HelpCircle } from 'lucide-react';

export const STATUS_CONFIG: Record<string, { label: string, color: string, bg: string, icon: any }> = {
  'ANSWERED': { label: 'Atendida', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)', icon: Phone },
  'NO ANSWER': { label: 'Sem Resposta', color: '#ca8a04', bg: 'rgba(202, 138, 4, 0.1)', icon: PhoneOff },
  'BUSY': { label: 'Ocupado', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.1)', icon: PhoneOff },
  'FAILED': { label: 'Falhou', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)', icon: AlertCircle },
  'CONGESTION': { label: 'Congestionado', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)', icon: Activity },
  'NO_ROUTE': { label: 'Sem Rota', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', icon: AlertCircle },
  'ROUTE_UNAVAILABLE': { label: 'Rota Indisp.', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', icon: AlertCircle },
  'DUPLICATED': { label: 'Duplicado', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', icon: AlertCircle },
  'SENT': { label: 'Enviada', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', icon: Send },
  'UNKNOWN': { label: 'Desconhecido', color: '#1f2937', bg: 'rgba(31, 41, 55, 0.1)', icon: HelpCircle },
};

export const CALL_STATUS_OPTIONS = Object.keys(STATUS_CONFIG);