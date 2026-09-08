import { render, screen } from '@testing-library/react';
import { vi, test, expect } from 'vitest';
import AssemblyPreview from './AssemblyPreview';

vi.mock('@react-three/fiber', () => ({
  Canvas: () => {
    throw new Error('WebGL unavailable');
  },
}));
vi.mock('@react-three/drei', () => ({
  Bounds: () => null,
  OrbitControls: () => null,
}));

test('keeps the editor usable when the 3D renderer fails', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    render(
      <>
        <button>Edit design</button>
        <AssemblyPreview
          parts={{ tray: { slices: [], explode: 0 } }}
          cases={{ tray: { stl: new Uint8Array(84) } }}
          exploded={false}
          selected=""
          onSelect={() => {}}
        />
      </>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('WebGL unavailable');
    expect(screen.getByRole('button', { name: 'Edit design' })).toBeEnabled();
  } finally {
    error.mockRestore();
  }
});
