import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("❌ [ERROR BOUNDARY] Unexpected error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm mx-auto">
            <div className="text-6xl mb-2">😕</div>
            <h1 className="text-2xl font-bold bg-ocean-gradient bg-clip-text text-transparent">
              Something went wrong
            </h1>
            <p className="text-foreground/70">
              An unexpected error occurred. Please reload the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold py-3 rounded-lg transition-all duration-300"
            >
              🔄 Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
