/**
 * @vitest-environment jsdom
 */

import '@testing-library/jest-dom/vitest';
import type { ComponentProps, PropsWithChildren } from 'react';
import type { Link } from 'react-router-dom';
import { vi } from 'vitest';

window.URL.createObjectURL = vi.fn();

// Polyfill for TextEncoder and TextDecoder
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Global mock for react-router-dom
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, onClick, ...props }: ComponentProps<typeof Link>) => {
    return (
      <a
        href={typeof to === 'string' ? to : to.pathname}
        onClick={onClick}
        {...props}
      >
        {children}
      </a>
    );
  },
  useNavigate: () => vi.fn(),
  Navigate: () => null,
  Routes: ({ children }: PropsWithChildren) => children,
  Route: () => null,
}));

// Global mock for workers to avoid import.meta syntax issues in tests
vi.mock('./workers/workerFactory', () => ({
  createErgogenWorker: () => null,
  createJscadWorker: () => null,
}));
