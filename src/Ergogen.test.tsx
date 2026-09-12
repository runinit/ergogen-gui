import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Ergogen from './Ergogen';
import { useConfigContext } from './context/ConfigContext';

vi.mock('./context/ConfigContext', () => ({
  useConfigContext: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
}));

vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: vi.fn(),
}));

vi.mock('./molecules/BoardStudio', () => ({
  default: function MockBoardStudio() {
    const [stage, setStage] = React.useState('Design');
    return <button onClick={() => setStage('Case')}>{stage}</button>;
  },
}));

// Mock sub-components
vi.mock('./molecules/ConfigEditor', () => {
  const MockConfigEditor = () => <div data-testid="mock-config-editor" />;
  MockConfigEditor.displayName = 'MockConfigEditor';
  return { default: MockConfigEditor };
});
vi.mock('./molecules/InjectionEditor', () => {
  const MockInjectionEditor = () => <div data-testid="mock-injection-editor" />;
  MockInjectionEditor.displayName = 'MockInjectionEditor';
  return { default: MockInjectionEditor };
});
vi.mock('./molecules/Downloads', () => {
  const MockDownloads = () => <div data-testid="mock-downloads" />;
  MockDownloads.displayName = 'MockDownloads';
  return { default: MockDownloads };
});
vi.mock('./molecules/Injections', () => {
  const MockInjections = () => <div data-testid="mock-injections" />;
  MockInjections.displayName = 'MockInjections';
  return { default: MockInjections };
});
vi.mock('./molecules/FilePreview', () => {
  const MockFilePreview = () => <div data-testid="mock-file-preview" />;
  MockFilePreview.displayName = 'MockFilePreview';
  return { default: MockFilePreview };
});
vi.mock('./molecules/ResizablePanel', () => {
  const MockResizablePanel = ({ children }: any) => <div>{children}</div>;
  MockResizablePanel.displayName = 'MockResizablePanel';
  return { default: MockResizablePanel };
});

// Mock zip, share, and analytics utils
const mockCreateZip = vi.fn();
vi.mock('./utils/zip', () => ({
  createZip: (...args: any[]) => mockCreateZip(...args),
}));

const mockCreateShareableUri = vi.fn().mockReturnValue('https://share.link');
vi.mock('./utils/share', () => ({
  createShareableUri: (...args: any[]) => mockCreateShareableUri(...args),
}));

const mockTrackEvent = vi.fn();
vi.mock('./utils/analytics', () => ({
  trackEvent: (...args: any[]) => mockTrackEvent(...args),
}));

describe('Ergogen Subheader Buttons', () => {
  const mockContextValue = {
    configs: [],
    activeConfigId: '1',
    activeConfigName: 'My Awesome Board',
    isPreview: false,
    results: null,
    configInput: 'points: {}',
    injectionInput: [],
    debug: false,
    stlPreview: false,
    isGenerating: false,
    isJscadConverting: false,
    showSettings: false,
    showSideNav: false,
    showConfig: true,
    showDownloads: false,
    setShowSettings: vi.fn(),
    setShowSideNav: vi.fn(),
    setShowConfig: vi.fn(),
    setShowDownloads: vi.fn(),
    generateNow: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfigContext, { partial: true }).mockReturnValue(
      mockContextValue
    );
  });

  it('keeps the native workspace mounted while settings are open', () => {
    const context = {
      ...mockContextValue,
      configInput: 'schema: ergogen/v1\nlayout: {}',
    };
    vi.mocked(useConfigContext, { partial: true }).mockReturnValue(context);
    const view = render(<Ergogen />);
    fireEvent.click(screen.getByRole('button', { name: 'Design' }));

    vi.mocked(useConfigContext, { partial: true }).mockReturnValue({
      ...context,
      showSettings: true,
    });
    view.rerender(<Ergogen />);
    vi.mocked(useConfigContext, { partial: true }).mockReturnValue(context);
    view.rerender(<Ergogen />);

    expect(screen.getByRole('button', { name: 'Case' })).toBeInTheDocument();
  });

  it('does not mistake a schema mention in a comment for a native project', () => {
    vi.mocked(useConfigContext, { partial: true }).mockReturnValue({
      ...mockContextValue,
      configInput: '# See ergogen/v1 for the new format\npoints: {}',
    });
    render(<Ergogen />);
    expect(screen.getByTestId('mock-config-editor')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Design' })
    ).not.toBeInTheDocument();
  });

  it('retains the editor during invalid YAML and resets it for another project', () => {
    const context = {
      ...mockContextValue,
      configInput: 'schema: ergogen/v1\nlayout: {}',
    };
    vi.mocked(useConfigContext, { partial: true }).mockReturnValue(context);
    const view = render(<Ergogen />);
    fireEvent.click(screen.getByRole('button', { name: 'Design' }));
    vi.mocked(useConfigContext, { partial: true }).mockReturnValue({
      ...context,
      configInput: 'schema: [unfinished',
    });
    view.rerender(<Ergogen />);
    expect(screen.getByRole('button', { name: 'Case' })).toBeInTheDocument();

    vi.mocked(useConfigContext, { partial: true }).mockReturnValue({
      ...context,
      activeConfigId: '2',
      configInput: 'points: [unfinished',
    });
    view.rerender(<Ergogen />);
    expect(screen.getByTestId('mock-config-editor')).toBeInTheDocument();
  });

  it('renders mobile share button and triggers share logic on click when showConfig is true', () => {
    render(<Ergogen />);
    const shareBtn = screen.getByTestId('mobile-share-button');
    expect(shareBtn).toBeInTheDocument();

    fireEvent.click(shareBtn);
    expect(screen.getByText('Share Configuration')).toBeInTheDocument();

    const innerShareBtn = screen.getByRole('button', { name: 'Share' });
    fireEvent.click(innerShareBtn);

    expect(mockCreateShareableUri).toHaveBeenCalledWith({
      config: 'points: {}',
      injections: undefined,
    });
    expect(
      screen.getByText('Shareable Configuration Link')
    ).toBeInTheDocument();
  });

  it('renders mobile archive button and triggers download archive logic on click when showConfig is false', () => {
    vi.mocked(useConfigContext, { partial: true }).mockReturnValue({
      ...mockContextValue,
      showConfig: false,
      results: { canonical: 'canonical_yaml' },
    });
    render(<Ergogen />);
    const archiveBtn = screen.getByTestId('mobile-download-outputs-button');
    expect(archiveBtn).toBeInTheDocument();

    fireEvent.click(archiveBtn);
    expect(mockCreateZip).toHaveBeenCalledWith(
      { canonical: 'canonical_yaml' },
      'points: {}',
      [],
      false,
      false
    );
  });
});
