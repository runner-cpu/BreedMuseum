import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import { breeds } from '@/data/breeds';
import { renderAppAt } from '@/test/render';

const firstId = 'dongbei-min-pig';
const secondId = 'nanyang-cattle';

test('compare page restores selected breeds from a share URL', async () => {
  const first = breeds.find((breed) => breed.id === firstId);
  const second = breeds.find((breed) => breed.id === secondId);
  expect(first).toBeDefined();
  expect(second).toBeDefined();

  renderAppAt(`/compare?compare=${firstId},${secondId}`);

  expect(await screen.findByRole('button', { name: `移除${first!.name}` })).toBeVisible();
  expect(screen.getByRole('button', { name: `移除${second!.name}` })).toBeVisible();
});

test('compare page writes removals and clearing back to the share URL', async () => {
  const first = breeds.find((breed) => breed.id === firstId);
  renderAppAt(`/compare?breeds=${firstId},${secondId}`);

  const remove = await screen.findByRole('button', { name: `移除${first!.name}` });
  fireEvent.click(remove);
  await waitFor(() => {
    expect(window.location.hash).toContain(`/compare?compare=${secondId}`);
  });

  fireEvent.click(screen.getByRole('button', { name: /清空对比/ }));
  await waitFor(() => {
    expect(window.location.hash).toContain('/compare');
    expect(window.location.hash).not.toContain('compare=');
  });
});
