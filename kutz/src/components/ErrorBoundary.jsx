import { Component } from 'react';
import { COLORS } from '../lib/constants';

/**
 * Catches any uncaught render errors and shows a recovery screen
 * instead of a blank white page.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-5"
        style={{ background: COLORS.bg }}
      >
        <div className="text-4xl">😬</div>
        <div>
          <p className="font-semibold text-base" style={{ color: COLORS.textPrimary }}>
            Something went wrong
          </p>
          <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-2xl text-sm font-semibold"
          style={{ background: COLORS.green, color: '#020617' }}
        >
          Reload app
        </button>
      </div>
    );
  }
}
