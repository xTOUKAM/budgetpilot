import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowUpRight, Banknote, ChartNoAxesCombined, Download, LayoutDashboard, Pencil, Plus, Search, Settings, Target, Trash2, Repeat, Wallet } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const euro = (cents: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const today = () => new Date().toISOString().slice(0, 10);
const COLORS = ['#8b7cff', '#39c6a5', '#f5b84b', '#ed7295', '#5ca7ff', '#a7b0c0'];

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [page, setPage] = useState('dashboard');
  const [error, setError] = useState('');
  const [showTransaction, setShowTransaction] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<DashboardData['transactions'][number] | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [history, setHistory] = useState<DashboardData['transactions']>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [statistics, setStatistics] = useState<{ byMonth: Array<{ month: string; income: number; expenses: number }>; byCategory: Array<{ category: string; amountCents: number }> } | null>(null);
  const [forecast, setForecast] = useState<{ days: number; points: Array<{ date: string; balanceCents: number }>; assumptions: string[] } | null>(null);

  async function refresh() {
    try { setData(await window.budgetPilot.getDashboard()); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur de chargement'); }
  }
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (page === 'history') void window.budgetPilot.searchHistory({ search: historySearch }).then(setHistory).catch(e => setError(e instanceof Error ? e.message : 'Recherche impossible'));
    if (page === 'statistics') void window.budgetPilot.getStatistics({ from: '0000-01-01', to: '9999-12-31' }).then(setStatistics).catch(e => setError(e instanceof Error ? e.message : 'Statistiques indisponibles'));
    if (page === 'statistics') void window.budgetPilot.getForecast({ days: 30 }).then(setForecast).catch(e => setError(e instanceof Error ? e.message : 'Prévision indisponible'));
  }, [page, historySearch]);

  const balance = useMemo(() => data?.accounts.reduce((sum, a) => sum + a.balanceCents, 0) ?? 0, [data]);
  const spentByCategory = data?.categoryTotals ?? [];

  async function exportCsv() {
    try {
      const csv = await window.budgetPilot.exportCsv();
      const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `budgetpilot-${today()}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : 'Export impossible'); }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><span className="brand-monogram">BP</span></div><div><strong>BudgetPilot</strong><small>FINANCES PERSONNELLES</small></div></div>
      <div className="nav-label">ESPACE FINANCIER</div>
      <nav>
        <button className={page === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('dashboard')}><LayoutDashboard size={18}/>Vue d'ensemble</button>
        <button className={page === 'accounts' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('accounts')}><Banknote size={18}/>Mes comptes</button>
        <button className={page === 'budgets' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('budgets')}><ChartNoAxesCombined size={18}/>Budgets</button>
        <button className={page === 'savings' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('savings')}><Target size={18}/>Objectifs d'épargne</button>
        <button className={page === 'recurring' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('recurring')}><Repeat size={18}/>Récurrences</button>
        <button className={page === 'history' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('history')}><Search size={18}/>Historique</button>
        <button className={page === 'statistics' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('statistics')}><ChartNoAxesCombined size={18}/>Statistiques</button>
        <button className={page === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('settings')}><Settings size={18}/>Paramètres</button>
      </nav>
      <div className="sidebar-bottom"><div className="local-badge"><span/>Données stockées localement</div><small>BudgetPilot · Version 0.1.0</small></div>
    </aside>

    <main className="main">
      <header className="topbar"><div><span className="eyebrow">VOTRE ARGENT, EN UN COUP D'ŒIL</span><h1>{{dashboard:'Vue d’ensemble',accounts:'Mes comptes',budgets:'Budgets mensuels',savings:'Objectifs d’épargne',recurring:'Récurrences',history:'Historique',statistics:'Statistiques',settings:'Paramètres'}[page] ?? 'BudgetPilot'}</h1></div><div className="top-actions"><span className="date-chip">{new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date())}</span><button className="secondary-btn" onClick={() => setShowTransfer(true)}>Transférer</button><button className="primary-btn" onClick={() => setShowTransaction(true)}><Plus size={17}/> Ajouter une opération</button></div></header>
      {error && <div className="error-banner">{error}</div>}
      {!data ? <div className="loading">Chargement de vos finances…</div> : <>
        {page === 'dashboard' && <>
          <section className="hero-card"><div className="hero-copy"><span className="muted-label">SOLDE TOTAL DE VOS COMPTES</span><div className="hero-balance">{euro(balance)}</div><div className="hero-foot"><span className="hero-dot"/> Solde calculé à partir des opérations enregistrées</div></div></section>
          <section className="stat-grid">
            <Stat title="Revenus du mois" value={euro(data.income)} tone="green" icon={<ArrowDownLeft size={19}/>} foot="Entrées enregistrées"/>
            <Stat title="Dépenses du mois" value={euro(data.expenses)} tone="red" icon={<ArrowUpRight size={19}/>} foot="Sorties enregistrées"/>
            <Stat title="Reste du mois" value={euro(data.income - data.expenses)} tone="purple" icon={<Activity size={19}/>} foot="Revenus moins dépenses"/>
          </section>
          <section className="content-grid">
            <div className="panel"><div className="panel-heading"><div><h2>Dépenses par catégorie</h2><p>Répartition sur le mois en cours</p></div><span className="panel-icon"><ChartNoAxesCombined size={18}/></span></div>
              {spentByCategory.length ? <div className="chart-layout"><div className="donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={spentByCategory} dataKey="amountCents" nameKey="category" innerRadius={58} outerRadius={82} paddingAngle={4}>{spentByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}</Pie><Tooltip formatter={(v) => euro(Number(v))}/></PieChart></ResponsiveContainer></div><div className="legend">{spentByCategory.slice(0, 6).map((item, i) => <div className="legend-row" key={item.category}><span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }}/><span>{item.category}</span><strong>{euro(item.amountCents)}</strong></div>)}</div></div> : <Empty text="Ajoutez des dépenses pour voir apparaître vos catégories."/>}
            </div>
            <div className="panel"><div className="panel-heading"><div><h2>Mes comptes</h2><p>Votre argent, réparti par compte</p></div><button className="icon-btn" title="Ajouter un compte" onClick={() => setShowAccount(true)}><Plus size={18}/></button></div>
              <div className="account-list">{data.accounts.map((account, i) => <div className="account-row" key={account.id}><div className={`account-symbol symbol-${i % 4}`}><Wallet size={18}/></div><div className="account-name"><strong>{account.name}</strong><small>{({bank:'Compte bancaire',cash:'Espèces',savings:'Épargne',other:'Autre'})[account.type] ?? account.type}</small></div><strong className="account-amount">{euro(account.balanceCents)}</strong></div>)}</div><button className="text-btn" onClick={() => setPage('accounts')}>Gérer mes comptes <span>→</span></button>
            </div>
          </section>
          <section className="panel transactions-panel"><div className="panel-heading"><div><h2>Dernières opérations</h2><p>Vos transactions les plus récentes</p></div><button className="text-btn" onClick={exportCsv}><Download size={15}/> Exporter CSV</button></div>
            {data.transactions.length ? <div className="table-wrap"><table><thead><tr><th>OPÉRATION</th><th>CATÉGORIE</th><th>COMPTE</th><th>DATE</th><th className="align-right">MONTANT</th><th></th></tr></thead><tbody>{data.transactions.map(t => <tr key={t.id}><td><div className="transaction-title"><span className={t.type === 'income' ? 'transaction-icon income' : 'transaction-icon expense'}>{t.type === 'income' ? <ArrowDownLeft size={16}/> : <ArrowUpRight size={16}/>}</span><div><strong>{t.note || t.category}</strong><small>{t.type === 'income' ? 'Revenu' : 'Dépense'}</small></div></div></td><td><span className="category-pill">{t.category}</span></td><td>{t.accountName}</td><td>{new Date(t.date + 'T12:00:00').toLocaleDateString('fr-FR')}</td><td className={`align-right amount ${t.type === 'income' ? 'positive' : 'negative'}`}>{t.type === 'income' ? '+' : '−'}{euro(t.amountCents)}</td><td><button className="table-action" title="Modifier" onClick={() => setEditingTransaction(t)}><Pencil size={14}/></button><button className="table-action danger" title="Supprimer" onClick={async () => { if (!window.confirm('Supprimer cette opération ?')) return; try { await window.budgetPilot.deleteTransaction(t.id); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Suppression impossible'); } }}><Trash2 size={14}/></button></td></tr>)}</tbody></table></div> : <Empty text="Aucune opération pour le moment. Ajoutez votre première transaction."/>}
          </section>
        </>}
        {page === 'accounts' && <section className="panel page-panel"><div className="panel-heading"><div><h2>Tous vos comptes</h2><p>Le solde évolue automatiquement avec les opérations.</p></div><button className="primary-btn" onClick={() => setShowAccount(true)}><Plus size={16}/> Ajouter un compte</button></div><div className="account-cards">{data.accounts.map((a, i) => <div className="account-card" key={a.id}><div className={`account-symbol symbol-${i % 4}`}><Wallet size={20}/></div><span className="muted-label">{({bank:'COMPTE BANCAIRE',cash:'ESPÈCES',savings:'ÉPARGNE',other:'AUTRE'})[a.type] ?? a.type}</span><h3>{a.name}</h3><div className="account-amount large">{euro(a.balanceCents)}</div><button className="text-btn" onClick={async()=>{ if (!window.confirm(`Archiver « ${a.name} » ?`)) return; await window.budgetPilot.archiveAccount(a.id); await refresh(); }}>Archiver le compte</button></div>)}</div></section>}
        {page === 'budgets' && <section className="panel page-panel"><div className="panel-heading"><div><h2>Budgets du mois</h2><p>Comparez vos dépenses aux limites que vous fixez.</p></div><button className="primary-btn" onClick={() => setShowBudget(true)}><Plus size={16}/> Définir un budget</button></div>{data.budgets.length ? <div className="budget-list">{data.budgets.map(b => { const spent = data.categoryTotals.find(c => c.category === b.category)?.amountCents ?? 0; const pct = Math.min(100, Math.round(spent / b.limitCents * 100)); return <div className="budget-row" key={b.id}><div className="budget-meta"><strong>{b.category}</strong><span>{euro(spent)} / {euro(b.limitCents)}</span></div><div className="progress"><span style={{ width: `${pct}%`, background: pct >= 100 ? '#f07886' : '#8b7cff' }}/></div><small>{pct}% utilisé</small></div>; })}</div> : <Empty text="Aucun budget défini pour ce mois. Créez un budget par catégorie."/>}</section>}
        {page === 'savings' && <section className="panel page-panel"><div className="panel-heading"><div><h2>Vos objectifs</h2><p>Gardez le cap sur vos projets.</p></div><button className="primary-btn" onClick={() => setShowGoal(true)}><Plus size={16}/> Nouvel objectif</button></div>{data.goals.length ? <div className="goal-grid">{data.goals.map(g => { const pct = Math.min(100, Math.round(g.savedCents / g.targetCents * 100)); return <div className="goal-card" key={g.id}><div className="goal-icon"><Target size={21}/></div><h3>{g.name}</h3><div className="goal-amount">{euro(g.savedCents)} <span>sur {euro(g.targetCents)}</span></div><div className="progress"><span style={{width:`${pct}%`}}/></div><small>{pct}% atteint</small></div>; })}</div> : <Empty text="Créez un objectif pour suivre votre épargne."/>}</section>}
        {page === 'recurring' && <RecurringPage data={data} onRefresh={refresh} onError={setError}/>}
        {page === 'history' && <section className="panel page-panel"><div className="panel-heading"><div><h2>Rechercher dans vos opérations</h2><p>Les filtres sont appliqués aux données locales.</p></div></div><input className="search-input" value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Rechercher un libellé ou une catégorie..." />{history.length ? <div className="table-wrap"><table><thead><tr><th>DATE</th><th>LIBELLÉ</th><th>CATÉGORIE</th><th>COMPTE</th><th className="align-right">MONTANT</th></tr></thead><tbody>{history.map(t => <tr key={t.id}><td>{t.date}</td><td>{t.note || t.category}</td><td>{t.category}</td><td>{t.accountName}</td><td className={`align-right amount ${t.type === 'income' ? 'positive' : 'negative'}`}>{t.type === 'income' ? '+' : '−'}{euro(t.amountCents)}</td></tr>)}</tbody></table></div> : <Empty text="Aucune opération ne correspond à votre recherche."/>}</section>}
        {page === 'statistics' && <StatisticsPage statistics={statistics} forecast={forecast}/>}
        {page === 'settings' && <SettingsPage data={data} onRefresh={refresh} onError={setError}/>}
      </>}
      <footer>BudgetPilot <span>•</span> Vos données restent sur cet ordinateur.</footer>
    </main>

    {showTransaction && <Modal title="Ajouter une opération" onClose={() => setShowTransaction(false)}><TransactionForm accounts={data?.accounts ?? []} onCancel={() => setShowTransaction(false)} onSave={async v => { await window.budgetPilot.createTransaction(v); setShowTransaction(false); await refresh(); }}/></Modal>}
    {showTransfer && <Modal title="Transférer entre comptes" onClose={() => setShowTransfer(false)}><TransferForm accounts={data?.accounts ?? []} onCancel={() => setShowTransfer(false)} onSave={async v => { await window.budgetPilot.createTransfer(v); setShowTransfer(false); await refresh(); }}/></Modal>}
    {editingTransaction && <Modal title="Modifier l'opération" onClose={() => setEditingTransaction(null)}><TransactionForm accounts={data?.accounts ?? []} initial={editingTransaction} onCancel={() => setEditingTransaction(null)} onSave={async v => { await window.budgetPilot.updateTransaction({ ...v, id: editingTransaction.id }); setEditingTransaction(null); await refresh(); }}/></Modal>}
    {showAccount && <Modal title="Ajouter un compte" onClose={() => setShowAccount(false)}><AccountForm onCancel={() => setShowAccount(false)} onSave={async v => { await window.budgetPilot.createAccount(v); setShowAccount(false); await refresh(); }}/></Modal>}
    {showBudget && <Modal title="Définir un budget" onClose={() => setShowBudget(false)}><BudgetForm month={data?.month ?? today().slice(0,7)} onCancel={() => setShowBudget(false)} onSave={async v => { await window.budgetPilot.saveBudget(v); setShowBudget(false); await refresh(); }}/></Modal>}
    {showGoal && <Modal title="Nouvel objectif d'épargne" onClose={() => setShowGoal(false)}><GoalForm onCancel={() => setShowGoal(false)} onSave={async v => { await window.budgetPilot.saveSavingsGoal(v); setShowGoal(false); await refresh(); }}/></Modal>}
  </div>;
}

function Stat({ title, value, tone, icon, foot }: { title: string; value: string; tone: string; icon: React.ReactNode; foot: string }) {
  return <div className="stat-card"><div className="stat-top"><span>{title}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><strong>{value}</strong><small>{foot}</small></div>;
}

function TransferForm({ accounts, onCancel, onSave }: { accounts: DashboardData['accounts']; onCancel: () => void; onSave: (v: { fromAccountId: number; toAccountId: number; amountCents: number; date: string; note: string }) => Promise<void> }) {
  const [fromAccountId, setFrom] = useState(String(accounts[0]?.id ?? ''));
  const [toAccountId, setTo] = useState(String(accounts[1]?.id ?? ''));
  const [amount, setAmount] = useState(''); const [date, setDate] = useState(today()); const [note, setNote] = useState('');
  async function submit(e: React.FormEvent) { e.preventDefault(); const cents = Math.round(Number(amount.replace(',', '.')) * 100); if (!Number.isSafeInteger(cents) || cents <= 0 || fromAccountId === toAccountId) return; await onSave({ fromAccountId: Number(fromAccountId), toAccountId: Number(toAccountId), amountCents: cents, date, note }); }
  return <form className="form" onSubmit={submit}><div className="form-row"><label>Depuis<select value={fromAccountId} onChange={e=>setFrom(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Vers<select value={toAccountId} onChange={e=>setTo(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label></div><label>Montant (€)<input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" required/></label><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label><label>Note<input value={note} onChange={e=>setNote(e.target.value)}/></label><div className="form-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Annuler</button><button className="primary-btn">Transférer</button></div></form>;
}

function RecurringPage({ data, onRefresh, onError }: { data: DashboardData; onRefresh: () => Promise<void>; onError: (message: string) => void }) {
  const [label, setLabel] = useState(''); const [amount, setAmount] = useState(''); const [accountId, setAccountId] = useState(String(data.accounts[0]?.id ?? '')); const [type, setType] = useState('expense'); const [frequency, setFrequency] = useState('monthly'); const [nextDate, setNextDate] = useState(today()); const [category, setCategory] = useState('Abonnements');
  async function save(e: React.FormEvent) { e.preventDefault(); try { await window.budgetPilot.saveRecurring({ label, amountCents: Math.round(Number(amount.replace(',', '.')) * 100), accountId: Number(accountId), type, frequency, nextDate, startDate: nextDate, category }); setLabel(''); setAmount(''); await onRefresh(); } catch (e) { onError(e instanceof Error ? e.message : 'Récurrence invalide'); } }
  return <section className="panel page-panel"><div className="panel-heading"><div><h2>Opérations récurrentes</h2><p>Les échéances sont générées une seule fois par date.</p></div><button className="secondary-btn" onClick={async()=>{ try { await window.budgetPilot.runDueRecurring(); await onRefresh(); } catch(e) { onError(e instanceof Error ? e.message : 'Exécution impossible'); } }}>Rattraper les échéances</button></div><form className="inline-form" onSubmit={save}><input placeholder="Libellé" value={label} onChange={e=>setLabel(e.target.value)} required/><input placeholder="Montant €" value={amount} onChange={e=>setAmount(e.target.value)} required/><select value={accountId} onChange={e=>setAccountId(e.target.value)}>{data.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><select value={type} onChange={e=>setType(e.target.value)}><option value="expense">Dépense</option><option value="income">Revenu</option></select><select value={frequency} onChange={e=>setFrequency(e.target.value)}><option value="daily">Quotidienne</option><option value="weekly">Hebdomadaire</option><option value="monthly">Mensuelle</option><option value="quarterly">Trimestrielle</option><option value="yearly">Annuelle</option></select><input type="date" value={nextDate} onChange={e=>setNextDate(e.target.value)}/><button className="primary-btn">Ajouter</button></form>{data.recurring.length ? <div className="table-wrap"><table><thead><tr><th>LIBELLÉ</th><th>TYPE</th><th>FRÉQUENCE</th><th>PROCHAINE ÉCHÉANCE</th><th>MONTANT</th><th>ÉTAT</th></tr></thead><tbody>{data.recurring.map(r=><tr key={r.id}><td>{r.label}</td><td>{r.type === 'income' ? 'Revenu' : 'Dépense'}</td><td>{r.frequency}</td><td>{r.nextDate}</td><td>{euro(r.amountCents)}</td><td><button className="text-btn" onClick={async()=>{ await window.budgetPilot.toggleRecurring({ id:r.id, active: !r.active }); await onRefresh(); }}>{r.active ? 'Suspendre' : 'Réactiver'}</button></td></tr>)}</tbody></table></div> : <Empty text="Aucune opération récurrente définie."/>}</section>;
}

function StatisticsPage({ statistics, forecast }: { statistics: { byMonth: Array<{ month: string; income: number; expenses: number }>; byCategory: Array<{ category: string; amountCents: number }> } | null; forecast: { days: number; points: Array<{ date: string; balanceCents: number }>; assumptions: string[] } | null }) {
  return <section className="panel page-panel"><div className="panel-heading"><div><h2>Statistiques réelles</h2><p>Les transferts internes sont exclus des revenus et dépenses.</p></div></div>{statistics?.byMonth.length ? <div className="table-wrap"><table><thead><tr><th>MOIS</th><th>REVENUS</th><th>DÉPENSES</th><th>RESTE</th></tr></thead><tbody>{statistics.byMonth.map(row=><tr key={row.month}><td>{row.month}</td><td className="positive">{euro(row.income)}</td><td className="negative">{euro(row.expenses)}</td><td>{euro(row.income-row.expenses)}</td></tr>)}</tbody></table></div> : <Empty text="Ajoutez des opérations pour afficher les statistiques."/>}{statistics?.byCategory.length ? <div className="legend statistics-legend">{statistics.byCategory.map(row=><div className="legend-row" key={row.category}><span>{row.category}</span><strong>{euro(row.amountCents)}</strong></div>)}</div> : null}<div className="forecast-box"><h3>Prévision à 30 jours</h3>{forecast ? <><strong>{euro(forecast.points.at(-1)?.balanceCents ?? 0)}</strong><p>Estimation basée uniquement sur les échéances récurrentes actives.</p><small>{forecast.assumptions.join(' · ')}</small></> : <p>Calcul en cours…</p>}</div></section>;
}

function SettingsPage({ data, onRefresh, onError }: { data: DashboardData; onRefresh: () => Promise<void>; onError: (message: string) => void }) {
  const [name, setName] = useState(''); const [type, setType] = useState('expense');
  return <section className="panel page-panel"><div className="panel-heading"><div><h2>Paramètres et données</h2><p>Les fichiers restent sur cet ordinateur.</p></div><div className="top-actions"><button className="secondary-btn" onClick={async()=>{ try { await window.budgetPilot.backup(); } catch(e) { onError(e instanceof Error ? e.message : 'Sauvegarde impossible'); } }}>Sauvegarder</button><button className="secondary-btn" onClick={async()=>{ try { await window.budgetPilot.restore(); } catch(e) { onError(e instanceof Error ? e.message : 'Restauration impossible'); } }}>Restaurer</button></div></div><h3>Catégories</h3><form className="inline-form" onSubmit={async e=>{ e.preventDefault(); try { await window.budgetPilot.saveCategory({ name, type }); setName(''); await onRefresh(); } catch(e) { onError(e instanceof Error ? e.message : 'Catégorie invalide'); } }}><input placeholder="Nouvelle catégorie" value={name} onChange={e=>setName(e.target.value)} required/><select value={type} onChange={e=>setType(e.target.value)}><option value="expense">Dépense</option><option value="income">Revenu</option></select><button className="primary-btn">Ajouter</button></form><div className="category-list">{data.categories.map(c=><span className="category-pill" key={c.id}>{c.name}</span>)}</div><h3>Comptes actifs</h3>{data.accounts.map(a=><div className="settings-row" key={a.id}><span>{a.name}</span><button className="text-btn" onClick={async()=>{ try { await window.budgetPilot.archiveAccount(a.id); await onRefresh(); } catch(e) { onError(e instanceof Error ? e.message : 'Archivage impossible'); } }}>Archiver</button></div>)}</section>;
}
function Empty({ text }: { text: string }) { return <div className="empty"><div className="empty-icon"><Activity size={22}/></div><p>{text}</p></div>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal"><div className="modal-header"><h2>{title}</h2><button className="icon-btn" onClick={onClose}>×</button></div>{children}</div></div>;
}
function TransactionForm({ accounts, initial, onCancel, onSave }: { accounts: DashboardData['accounts']; initial?: DashboardData['transactions'][number]; onCancel: () => void; onSave: (v: { accountId: number; type: string; amountCents: number; date: string; category: string; note: string }) => Promise<void> }) {
  const [type, setType] = useState(initial?.type ?? 'expense');
  const [accountId, setAccountId] = useState(String(initial?.accountId ?? accounts[0]?.id ?? ''));
  const [amount, setAmount] = useState(initial ? String(initial.amountCents / 100).replace('.', ',') : '');
  const [date, setDate] = useState(initial?.date ?? today());
  const [category, setCategory] = useState(initial?.category ?? 'Alimentation');
  const [note, setNote] = useState(initial?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) { e.preventDefault(); const cents = Math.round(Number(amount.replace(',', '.')) * 100); if (!Number.isSafeInteger(cents) || cents <= 0 || !accountId || !category.trim()) { setError('Vérifiez le montant, le compte et la catégorie.'); return; } setBusy(true); try { await onSave({ accountId: Number(accountId), type, amountCents: cents, date, category: category.trim(), note }); } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible'); setBusy(false); } }
  return <form className="form" onSubmit={submit}><div className="segmented"><button type="button" className={type==='expense'?'selected':''} onClick={()=>setType('expense')}>Dépense</button><button type="button" className={type==='income'?'selected':''} onClick={()=>setType('income')}>Revenu</button></div><label>Montant (€)<input autoFocus value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0,00" inputMode="decimal" required/></label><div className="form-row"><label>Compte<select value={accountId} onChange={e=>setAccountId(e.target.value)}>{accounts.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label></div><label>Catégorie<select value={category} onChange={e=>setCategory(e.target.value)}>{['Logement','Alimentation','Transport','Abonnements','Santé','Loisirs','Salaire','Aides','Épargne','Autre'].map(c=><option key={c}>{c}</option>)}</select></label><label>Note (facultatif)<input value={note} onChange={e=>setNote(e.target.value)} placeholder="Ex. courses du samedi"/></label>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Annuler</button><button className="primary-btn" disabled={busy}>{busy?'Enregistrement…':initial ? 'Enregistrer les modifications' : 'Enregistrer'}</button></div></form>;
}
function AccountForm({ onCancel, onSave }: { onCancel: () => void; onSave: (v: { name: string; type: string; openingBalanceCents: number }) => Promise<void> }) {
  const [name,setName]=useState(''); const [type,setType]=useState('bank'); const [balance,setBalance]=useState('0'); const [error,setError]=useState('');
  async function submit(e: React.FormEvent) { e.preventDefault(); const cents=Math.round(Number(balance.replace(',','.'))*100); if (!name.trim()||!Number.isSafeInteger(cents)) {setError('Vérifiez le nom et le solde.');return;} try {await onSave({name:name.trim(),type,openingBalanceCents:cents});} catch(e){setError(e instanceof Error?e.message:'Erreur');} }
  return <form className="form" onSubmit={submit}><label>Nom du compte<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex. Compte courant" required/></label><label>Type<select value={type} onChange={e=>setType(e.target.value)}><option value="bank">Compte bancaire</option><option value="cash">Espèces</option><option value="savings">Épargne</option><option value="other">Autre</option></select></label><label>Solde initial (€)<input value={balance} onChange={e=>setBalance(e.target.value)} inputMode="decimal" required/></label>{error&&<p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Annuler</button><button className="primary-btn">Créer le compte</button></div></form>;
}
function BudgetForm({ month, onCancel, onSave }: { month: string; onCancel: () => void; onSave: (v: { category: string; limitCents: number; month: string }) => Promise<void> }) {
  const [category,setCategory]=useState('Alimentation'); const [amount,setAmount]=useState(''); const [error,setError]=useState('');
  async function submit(e: React.FormEvent) { e.preventDefault(); const cents=Math.round(Number(amount.replace(',','.'))*100); if(!Number.isSafeInteger(cents)||cents<=0){setError('Entrez un budget positif.');return;} try{await onSave({category,limitCents:cents,month});}catch(e){setError(e instanceof Error?e.message:'Erreur');} }
  return <form className="form" onSubmit={submit}><label>Catégorie<select value={category} onChange={e=>setCategory(e.target.value)}>{['Logement','Alimentation','Transport','Abonnements','Santé','Loisirs','Salaire','Aides','Épargne','Autre'].map(c=><option key={c}>{c}</option>)}</select></label><label>Limite mensuelle (€)<input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Ex. 250" inputMode="decimal" required/></label><label>Mois<input value={month} disabled/></label>{error&&<p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Annuler</button><button className="primary-btn">Enregistrer le budget</button></div></form>;
}
function GoalForm({ onCancel, onSave }: { onCancel: () => void; onSave: (v: { name: string; targetCents: number; savedCents: number }) => Promise<void> }) {
  const [name,setName]=useState(''); const [target,setTarget]=useState(''); const [saved,setSaved]=useState('0'); const [error,setError]=useState('');
  async function submit(e: React.FormEvent) { e.preventDefault(); const t=Math.round(Number(target.replace(',','.'))*100), s=Math.round(Number(saved.replace(',','.'))*100); if(!name.trim()||!Number.isSafeInteger(t)||t<=0||!Number.isSafeInteger(s)||s<0){setError('Vérifiez le nom et les montants.');return;} try{await onSave({name:name.trim(),targetCents:t,savedCents:s});}catch(e){setError(e instanceof Error?e.message:'Erreur');} }
  return <form className="form" onSubmit={submit}><label>Nom du projet<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex. Vacances" required/></label><label>Objectif (€)<input value={target} onChange={e=>setTarget(e.target.value)} inputMode="decimal" required/></label><label>Déjà épargné (€)<input value={saved} onChange={e=>setSaved(e.target.value)} inputMode="decimal" required/></label>{error&&<p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="secondary-btn" onClick={onCancel}>Annuler</button><button className="primary-btn">Créer l'objectif</button></div></form>;
}
