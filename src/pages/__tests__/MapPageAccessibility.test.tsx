import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { breeds } from '@/data/breeds';
import MapPage from '@/pages/MapPage';
import { renderWithProviders } from '@/test/render';

describe('MapPage accessible breed list', () => {
  it('expands from the first eight results to every filtered breed', () => {
    renderWithProviders(<MapPage />, { route: '/map' });

    const toggle = screen.getByRole('button', { name: /show all breeds|显示全部|查看全部/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAccessibleName(new RegExp(String(breeds.length)));

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const list = screen.getByRole('list', { name: /all filtered breeds|全部.*品种/i });
    expect(within(list).getAllByRole('button')).toHaveLength(breeds.length);

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list', { name: /all filtered breeds|全部.*品种/i })).not.toBeInTheDocument();
  });
});
