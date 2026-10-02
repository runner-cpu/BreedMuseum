import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AIPrivacyNotice from '../AIPrivacyNotice';
import { renderWithProviders } from '@/test/render';

describe('AI privacy notice', () => {
  it('names third-party processing and links to the public policy', () => {
    renderWithProviders(<AIPrivacyNotice />);
    expect(screen.getByRole('note')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', expect.stringContaining('privacy.html'));
  });
});
