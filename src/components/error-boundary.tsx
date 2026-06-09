"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackMessage?: string;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Katalyst Error]", error.message, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-[var(--destructive)]/30">
          <CardContent className="flex flex-col items-center py-10 gap-3">
            <div className="rounded-full bg-[var(--destructive)]/10 p-3">
              <AlertTriangle className="h-6 w-6 text-[var(--destructive)]" />
            </div>
            <p className="text-sm font-medium">
              {this.props.fallbackMessage ?? "Something went wrong."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
              className="gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Try again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
