import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress ResizeObserver loop limit errors which are common with charting libraries and benign
if (typeof window !== 'undefined') {
  const resizeObserverError = 'ResizeObserver loop completed with undelivered notifications';
  const resizeObserverLimit = 'ResizeObserver loop limit exceeded';
  
  // Guard window.performance.measure/mark against DataCloneError in sandboxed environments
  if (window.performance) {
    const originalMeasure = window.performance.measure;
    if (typeof originalMeasure === 'function') {
      window.performance.measure = function (...args) {
        try {
          return originalMeasure.apply(this, args);
        } catch (err) {
          // Suppress error and return a safe fallback PerformanceMeasure mock object
          return {
            entryType: 'measure',
            name: typeof args[0] === 'string' ? args[0] : 'measure',
            startTime: 0,
            duration: 0,
            detail: null,
            toJSON() { return {}; }
          } as any;
        }
      };
    }

    const originalMark = window.performance.mark;
    if (typeof originalMark === 'function') {
      window.performance.mark = function (...args) {
        try {
          return originalMark.apply(this, args);
        } catch (err) {
          // Suppress error and return a safe fallback PerformanceMark mock object
          return {
            entryType: 'mark',
            name: typeof args[0] === 'string' ? args[0] : 'mark',
            startTime: 0,
            duration: 0,
            detail: null,
            toJSON() { return {}; }
          } as any;
        }
      };
    }
  }

  window.addEventListener('error', (e) => {
    const isResizeObserver = e.message === resizeObserverError || 
                             e.message === resizeObserverLimit || 
                             (e.error && (e.error.message === resizeObserverError || e.error.message === resizeObserverLimit));
    
    const isPerformanceError = e.message && (
      e.message.toLowerCase().includes("measure") || 
      e.message.toLowerCase().includes("performance") || 
      e.message.toLowerCase().includes("datacloneerror")
    );

    if (isResizeObserver || isPerformanceError) {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
    }
  });

  // Also catch unhandled rejections for the same reasons
  window.addEventListener('unhandledrejection', (e) => {
    const isResizeObserver = e.reason && (e.reason.message === resizeObserverError || e.reason.message === resizeObserverLimit);
    const isPerformanceError = e.reason && e.reason.message && (
      e.reason.message.toLowerCase().includes("measure") || 
      e.reason.message.toLowerCase().includes("performance") || 
      e.reason.message.toLowerCase().includes("datacloneerror")
    );

    if (isResizeObserver || isPerformanceError) {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
