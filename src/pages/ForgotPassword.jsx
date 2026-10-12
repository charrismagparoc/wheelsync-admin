import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from '../components/ThemeToggle'
import heroImage from '../assets/hero.png'

export default function ForgotPassword() {
  const { requestPasswordReset, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendCode(e) {
    e?.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    const { error } = await requestPasswordReset(email)
    setBusy(false)
    if (error) return setError(error.message)
    setStep('code')
    setNotice('If an account exists for this email, we sent a 6-digit code. It expires in 15 minutes.')
  }

  async function handleReset(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    if (password !== confirm) return setError('The passwords do not match.')
    setBusy(true)
    const { error } = await resetPassword(email, code, password)
    setBusy(false)
    if (error) return setError(error.message)
    navigate('/login', { state: { notice: 'Your password has been changed. Sign in with your new password.' } })
  }

  return (
    <div className="min-h-screen galaxy-bg login-shell flex flex-col items-center justify-center p-6">
      <div className="absolute top-5 right-5"><ThemeToggle /></div>
      <div className="login-layout w-full max-w-6xl">
        <div className="login-brand-panel" style={{ backgroundImage: `url('/pardz-banner.png'), url(${heroImage})` }} aria-label="Pardz Car Rental" />
        <div className="w-full max-w-sm login-form-column">
        <div className="text-center mb-8">
          <div className="pardz-logo w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-white mb-4"><KeyRound size={28} strokeWidth={2.2} /></div>
          <h1 className="font-display text-2xl font-semibold">Forgot password</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {step === 'email' ? 'Enter your email and we will send you a code to reset your password.' : `Enter the code sent to ${email} and choose a new password.`}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={sendCode} className="card p-6 flex flex-col gap-4">
            {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{error}</p>}
            <label className="flex flex-col gap-1 text-sm">Email
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="px-3 py-2.5" placeholder="admin@pardzcarrental.com" />
            </label>
            <button type="submit" disabled={busy} className="pardz-signin btn-primary py-2.5 mt-2">{busy ? 'Sending…' : 'Send code'}</button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="card p-6 flex flex-col gap-4">
            {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--danger)' }}>{error}</p>}
            {notice && <p className="text-sm" role="status" style={{ color: 'var(--success)' }}>{notice}</p>}
            <label className="flex flex-col gap-1 text-sm">6-digit code
              <input
                required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="px-3 py-2.5 tracking-[0.4em] text-center" placeholder="123456"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">New password
              <input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="px-3 py-2.5" placeholder="At least 6 characters" />
            </label>
            <label className="flex flex-col gap-1 text-sm">Confirm new password
              <input type="password" required minLength={6} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="px-3 py-2.5" placeholder="••••••••" />
            </label>
            <button type="submit" disabled={busy} className="pardz-signin btn-primary py-2.5 mt-2">{busy ? 'Saving…' : 'Change password'}</button>
            <button type="button" disabled={busy} onClick={() => sendCode()} className="text-sm" style={{ color: 'var(--nebula-3)' }}>Send a new code</button>
          </form>
        )}

        <p className="text-center text-sm mt-5" style={{ color: 'var(--text-muted)' }}>
          Remembered it? <Link to="/login" style={{ color: 'var(--nebula-3)' }}>Back to sign in</Link>
        </p>
        </div>
      </div>
    </div>
  )
}
