import React from 'react';

export class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any, info: any}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    this.setState({ error, info });
    console.error("ErrorBoundary caught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return <div style={{padding: 20, color: 'red'}}>
        <h1>React Crash in Transfers</h1>
        <pre>{this.state.error?.toString()}</pre>
        <pre>{this.state.info?.componentStack}</pre>
      </div>;
    }
    return this.props.children;
  }
}
