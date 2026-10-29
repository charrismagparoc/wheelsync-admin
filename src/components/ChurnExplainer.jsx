import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import Modal from './Modal'

const FEATURE_INFO = {
  days_since_last_rental: { name: 'Days since last rental', formula: 'Today − date the last rental was returned', why: 'How long they have been away' },
  total_rentals_completed: { name: 'Completed rentals', formula: 'Count of completed rentals', why: 'How loyal they are' },
  avg_days_between_rentals: { name: 'Average gap between rentals', formula: 'Average days from one rental to the next', why: 'Their usual rhythm' },
  late_return_rate: { name: 'Late-return rate', formula: 'Late returns ÷ completed rentals', why: 'How they treat the rules' },
  preferred_service_type: { name: 'Preferred service', formula: 'Service they chose most often', why: 'Self-drive, with driver, or pickup' },
  customer_tenure_days: { name: 'Customer for (days)', formula: 'Today − date of their first rental', why: 'How long they have known Pardz' },
}

const pct = (value) => `${Math.round(value * 100)}%`

function formatValue(name, value) {
  if (name === 'late_return_rate') return pct(value)
  if (name === 'preferred_service_type') return String(value).replace('_', ' ')
  return Number(value).toLocaleString()
}

function Section({ step, title, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">
        {step && <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs text-white" style={{ background: 'var(--gradient-primary)' }}>{step}</span>}
        {title}
      </h3>
      {children}
    </section>
  )
}

// "How churn is computed": the model's method in plain words, a worked example and its measured scores.
//   example - one rated customer from the list ({ full_name, churn, churnFeatures }) used as the worked example
export default function ChurnExplainer({ example, onClose, onRetrained }) {
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/churn/model').then(setReport).catch((loadError) => setError(loadError.message))
  }, [])

  async function retrain() {
    setBusy(true)
    setError('')
    try {
      setReport(await api.post('/admin/churn/retrain'))
      onRetrained?.()
    } catch (retrainError) {
      setError(retrainError.message)
    }
    setBusy(false)
  }

  const threshold = report?.risk_threshold ?? 0.5
  const muted = { color: 'var(--text-muted)' }

  return (
    <Modal title="How churn is computed" description="How the Random Forest model rates customers and how it is trained on Pardz's completed rentals." onClose={onClose} size="max-w-3xl">
      <div className="flex flex-col gap-6 text-sm">
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface-2)' }}>
          <p className="font-semibold mb-1">In short</p>
          <p style={muted}>
            WheelSync turns each customer's completed rentals into <b>6 numbers</b>. A <b>Random Forest</b> of{' '}
            {report?.params?.n_estimators ?? 200} decision trees compares those numbers with past customers who kept renting or stopped.
            The share of trees that answer "will stop renting" is the <b>churn risk %</b>. It only supports your decision: it never sends
            promotions or blocks bookings.
          </p>
        </div>

        <Section step="1" title="Turn the rental history into 6 numbers">
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border-soft)' }}>
            <table className="w-full text-xs">
              <thead><tr className="text-left" style={muted}>
                <th className="px-3 py-2 font-medium">Feature</th>
                <th className="px-3 py-2 font-medium">Formula</th>
                <th className="px-3 py-2 font-medium">Tells us</th>
                {example && <th className="px-3 py-2 font-medium">{example.full_name}</th>}
              </tr></thead>
              <tbody>
                {Object.entries(FEATURE_INFO).map(([key, info]) => (
                  <tr key={key} style={{ borderTop: '1px solid var(--border-soft)' }}>
                    <td className="px-3 py-2 font-medium">{info.name}</td>
                    <td className="px-3 py-2" style={muted}>{info.formula}</td>
                    <td className="px-3 py-2" style={muted}>{info.why}</td>
                    {example && <td className="px-3 py-2 font-semibold whitespace-nowrap">{formatValue(key, example.churnFeatures[key])}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs" style={muted}>Customers with fewer than 2 completed rentals are shown as <b>New Customer - Not Yet Rated</b>: there is not enough history to compute these numbers reliably.</p>
        </Section>

        <Section step="2" title="How the model learned (the 180-day rule)">
          <p style={muted}>
            The history is cut at several past dates. For each cut, every customer with 2+ rentals gets the 6 numbers as of that date, and an
            answer that really happened: <b>churned</b> if they did <b>not</b> rent again within the next 180 days, <b>active</b> if they did.
          </p>
          {report && (
            <p style={muted}>
              From {report.rentals.toLocaleString()} completed rentals of {report.customers} customers this gave <b>{report.training_rows} examples</b> ({report.churned_rows} churned).
              They were split <b>80% for learning</b> ({report.train_rows}) and <b>20% for checking</b> ({report.test_rows}), stratified and with each customer on one side only,
              plus <b>5-fold cross-validation</b> on the learning part, so the model is checked on customers it has never seen.
              Settings: {report.params.n_estimators} trees, maximum depth {report.params.max_depth}, at least {report.params.min_samples_leaf} customers per leaf, balanced class weights.
            </p>
          )}
        </Section>

        <Section step="3" title="From 200 trees to one percentage">
          <div className="rounded-xl px-4 py-3 text-center font-mono text-sm" style={{ background: 'var(--bg-surface-2)' }}>
            Churn risk = (tree₁ + tree₂ + … + tree₂₀₀) ÷ 200
          </div>
          <p style={muted}>
            Each tree asks yes/no questions about the 6 numbers (for example "away more than 150 days?", "usual gap under 40 days?") and ends
            with its own estimate. The forest averages all of them, so no single tree decides.
            Why 200? More trees make the percentage steadier: with 10 trees a customer's risk could move up to 29 points between two
            trainings, with 200 trees about 2 points on average. Going to 500 barely changes the result but trains 3× slower.
            {example && example.churn.probability != null && <> For <b>{example.full_name}</b> the trees average to <b>{pct(example.churn.probability)}</b>.</>}
          </p>
        </Section>

        <Section step="4" title="What the labels mean">
          <ul className="flex flex-col gap-1.5" style={muted}>
            <li><span className="badge badge-rejected mr-2">At Risk of Churn</span>churn risk {pct(threshold)} or higher.</li>
            <li><span className="badge badge-accepted mr-2">Likely to Return</span>churn risk below {pct(threshold)}.</li>
            <li><span className="badge badge-rejected mr-2">Valuable – At Risk</span>at risk and in the top 25% by number of completed rentals: a frequent suki to contact first.</li>
            <li><span className="mr-2 text-xs">New Customer - Not Yet Rated</span>fewer than 2 completed rentals.</li>
          </ul>
          <p className="text-xs" style={muted}>
            Why {pct(threshold)} and not 50%? Missing a customer who is about to leave costs the most, so the cut-off was lowered until the model catches at least {pct(report?.recall_target ?? 0.75)} of
            the customers who really left (chosen on the learning data, then checked on the 20% kept aside).
          </p>
        </Section>

        <div className="modal-actions flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs" style={muted}>
            {report ? `Model trained ${new Date(report.trained_at).toLocaleString()}. Retrain after new rentals are completed.` : ''}
            {error && report && <span style={{ color: 'var(--danger)' }}> {error}</span>}
          </span>
          <div className="flex gap-2">
            <button onClick={retrain} disabled={busy} className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-sm"><RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> {busy ? 'Retraining…' : 'Retrain model'}</button>
            <button onClick={onClose} className="btn-primary px-4 py-2 text-sm">Close</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
