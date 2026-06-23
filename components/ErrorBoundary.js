import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Caught an error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
          <h1 className="text-3xl font-bold text-red-600 mb-4">⚠️ Application Error Detected</h1>
          <p className="text-gray-700 mb-4 max-w-lg">
            The dashboard encountered an error while loading. The error details are below.
            <br/><br/>
            <strong>This error is likely because a component is missing an import.</strong>
          </p>
          <div className="bg-gray-100 p-4 rounded-lg max-w-2xl w-full overflow-auto text-left border border-red-300">
            <p className="font-mono text-sm text-red-800 whitespace-pre-wrap">
              {this.state.error && this.state.error.toString()}
            </p>
            {this.state.errorInfo && (
              <details className="mt-2 text-xs text-gray-600">
                <summary className="cursor-pointer font-bold">Component Stack Trace</summary>
                <pre className="mt-2 p-2 bg-gray-800 text-white rounded overflow-auto">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
