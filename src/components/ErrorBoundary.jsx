import { Component } from 'react'

// Catches a crash in any page so the admin sees a message and a way back instead of a blank screen.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('WheelSync page error:', error, info?.componentStack)
  }

  componentDidUpdate(previousProps) {
    // Moving to another page (or pressing Refresh) clears the error.
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen flex items-center justify-center p-6 app-shell">
        <div role="alert" className="card p-6 max-w-md w-full">
          <h1 className="font-display text-xl font-semibold mb-2">Something went wrong on this page</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Your data is safe. Try again, or go back to the dashboard. If it keeps happening, tell the developer what you clicked.
          </p>
          <p className="text-xs mb-5 px-3 py-2 rounded-lg break-words" style={{ background: 'var(--bg-surface-2)', color: 'var(--danger)' }}>
            {this.state.error.message || String(this.state.error)}
          </p>
          <div className="flex gap-2">
            <button onClick={() => this.setState({ error: null })} className="btn-primary px-4 py-2 text-sm">Try again</button>
            <a href="/" className="btn-ghost px-4 py-2 text-sm">Go to dashboard</a>
          </div>
        </div>
      </div>
    )
  }
}
