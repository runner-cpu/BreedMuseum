import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '@/App';
import { AppWrapper } from '@/components/common/PageMeta';
import Layout from '@/components/layouts/Layout';
import { MuseumProvider } from '@/contexts/MuseumContext';
import { SettingsProvider } from '@/contexts/AppSettings';

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SettingsProvider>
        <MuseumProvider>{ui}</MuseumProvider>
      </SettingsProvider>
    </MemoryRouter>,
  );
}

export function renderAppAt(path: string) {
  window.location.hash = '#' + path;
  return render(
    <AppWrapper>
      <App />
    </AppWrapper>,
  );
}

export function renderLayout(path = '/') {
  return renderWithProviders(
    <Layout
      selectedCategory={null}
      onSelectCategory={() => undefined}
      searchValue=""
      onSearchChange={() => undefined}
    >
      <h1>Test page</h1>
    </Layout>,
    { route: path },
  );
}
