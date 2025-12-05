// src/components/CallCenter/CallLeadsList.tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { CallLeadD2 } from '@/types/callLeadsD2';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RefreshCw, Phone, User, CheckCircle, Clock } from 'lucide-react';

export default function CallLeadsList() {
  const [leads, setLeads] = useState<CallLeadD2[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Busca os dados do banco
  async function fetchLeads() {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('CALL_LEADS_D2')
      .select('*')
      .order('created_at', { ascending: false }); // Ordena do mais recente para o mais antigo

    if (data) {
      setLeads(data);
    }
    
    if (error) {
      console.error('Erro ao buscar leads:', error);
    }
    
    setLoading(false);
  }

  // Aciona o Gatilho (API que criamos)
  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/leads/sync-d2', { method: 'POST' });
      const json = await res.json();
      
      if (res.ok) {
        alert(json.message + ` (${json.ingested} novos, ${json.recovered} recuperados)`);
        fetchLeads(); // Atualiza a tabela na hora
      } else {
        alert('Erro: ' + json.error);
      }
    } catch (err) {
      alert('Erro de conexão ao sincronizar.');
      console.error(err);
    } finally {
      setSyncing(false);
    }
  }

  // Carrega ao iniciar o componente
  useEffect(() => {
    fetchLeads();
  }, []);

  // Formatador de data simples
  const fmtDate = (d: string | null) => 
    d ? format(new Date(d), "dd/MM HH:mm", { locale: ptBR }) : '-';

  return (
    <div style={{ marginTop: '2rem', fontFamily: 'Montserrat, sans-serif' }}>
      
      {/* CABEÇALHO DA SESSÃO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Fila de Recuperação (D+2)
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Monitoramento de jogadores inativos há 2 dias.
          </p>
        </div>
        
        <button 
          onClick={handleSync} 
          disabled={syncing}
          style={{
            background: syncing ? 'var(--bg-hover)' : 'var(--text-primary)',
            color: syncing ? 'var(--text-secondary)' : 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            padding: '12px 24px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: syncing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}
        >
          <RefreshCw size={18} className={syncing ? 'spin' : ''} />
          {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
        </button>
      </div>

      {/* TABELA */}
      <div style={{ 
        background: 'var(--bg-card)', 
        borderRadius: '24px', 
        border: '1px solid var(--border-color)', 
        overflow: 'hidden',
        boxShadow: '0 10px 30px -10px var(--shadow-color)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead style={{ 
            background: 'var(--bg-hover)', 
            color: 'var(--text-secondary)', 
            fontSize: '0.75rem', 
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            <tr>
              <th style={{ padding: '1.2rem', textAlign: 'left' }}>Passport</th>
              <th style={{ padding: '1.2rem', textAlign: 'left' }}>Nome / Whatsapp</th>
              <th style={{ padding: '1.2rem', textAlign: 'left' }}>Último Login (Captura)</th>
              <th style={{ padding: '1.2rem', textAlign: 'center' }}>Pós Login (Retorno)</th>
              <th style={{ padding: '1.2rem', textAlign: 'center' }}>Tempo Jogo</th>
              <th style={{ padding: '1.2rem', textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          
          <tbody>
            {loading && leads.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <RefreshCw size={24} className="spin" />
                    <span>Carregando dados...</span>
                  </div>
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Nenhum lead na fila. Clique em <b>Sincronizar Agora</b> para buscar na API.
                </td>
              </tr>
            ) : (
              leads.map(lead => (
                <tr key={lead.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                  
                  {/* PASSPORT */}
                  <td style={{ padding: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    #{lead.passport}
                  </td>
                  
                  {/* NOME E ZAP */}
                  <td style={{ padding: '1.2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {lead.name || 'Desconhecido'}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={12}/> {lead.whatsapp || '-'}
                      </span>
                    </div>
                  </td>
                  
                  {/* DATA CAPTURA (Fixo) */}
                  <td style={{ padding: '1.2rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {fmtDate(lead.last_login_at_ingestion)}
                  </td>

                  {/* DATA RETORNO (Dinâmico) */}
                  <td style={{ padding: '1.2rem', textAlign: 'center' }}>
                    {lead.current_last_login ? (
                      // Se tem data, é porque VOLTOU
                      <div style={{ 
                        color: '#10b981', 
                        fontWeight: 700, 
                        background: 'rgba(16, 185, 129, 0.1)', 
                        padding: '6px 12px', 
                        borderRadius: '8px',
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: 6 
                      }}>
                        <CheckCircle size={14} />
                        {fmtDate(lead.current_last_login)}
                      </div>
                    ) : (
                      // Se é NULL, ainda não voltou
                      <span style={{ 
                        color: 'var(--text-tertiary)', 
                        fontSize: '0.8rem', 
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}>
                        <Clock size={14} /> Aguardando
                      </span>
                    )}
                  </td>

                  {/* TEMPO DE JOGO */}
                  <td style={{ padding: '1.2rem', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {lead.time_played ? Math.floor(lead.time_played / 60) + 'h' : '-'}
                  </td>
                  
                  {/* STATUS */}
                  <td style={{ padding: '1.2rem', textAlign: 'center' }}>
                    <span style={{
                      padding: '6px 12px', 
                      borderRadius: '99px', 
                      fontSize: '0.7rem', 
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      backgroundColor: lead.is_recovered ? 'rgba(22, 163, 74, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                      color: lead.is_recovered ? '#16a34a' : '#ca8a04',
                      border: lead.is_recovered ? '1px solid rgba(22, 163, 74, 0.2)' : '1px solid rgba(234, 179, 8, 0.2)'
                    }}>
                      {lead.is_recovered ? 'RECUPERADO' : 'PENDENTE'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Estilo local para a animação de girar */}
      <style jsx>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}