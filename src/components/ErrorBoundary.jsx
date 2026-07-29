import { Component } from 'react'

/**
 * Catch a client-side exception in any screen and show a recoverable card
 * instead of letting it blow up the whole SPA to Next's raw "Application error"
 * screen. A transient bad data shape from a flaky RPC on a portfolio refresh
 * should never blank the app — the user gets a Retry that re-mounts the tree,
 * and a Reload as a fallback.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Leave a breadcrumb for the browser console without crashing the app.
    // eslint-disable-next-line no-console
    console.error('ESKA client exception:', error, info?.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="max-w-md mx-auto text-center py-24 px-6">
        <div className="mx-auto mb-5 w-12 h-12 rounded-full border-2 border-dashed border-[var(--color-line-2)]" />
        <h1 className="font-serif text-2xl mb-2">Something hiccuped</h1>
        <p className="text-[var(--color-ink-soft)] mb-7">
          The page hit a snag while loading — usually a momentary network blip. Try again.
        </p>
        <div className="flex items-center justify-center gap-2">
          <button onClick={this.reset} className="btn btn-primary">Try again</button>
          <button onClick={() => window.location.reload()} className="btn btn-secondary">Reload</button>
        </div>
      </div>
    )
  }
}
