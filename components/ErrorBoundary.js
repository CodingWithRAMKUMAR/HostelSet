import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Dashboard render failed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Something went wrong</h1>
          <p className="text-gray-700 mb-6 max-w-lg">The dashboard could not finish rendering. Reload the page and try again.</p>
          <button type="button" onClick={() => window.location.reload()} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-semibold">Reload dashboard</button>
        </div>
      );
    }
    return this.props.children;
  }
}
