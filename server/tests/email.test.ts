import { describe, it, expect } from 'vitest';
import { buildVerifyEmailHtml, buildResetPasswordHtml } from '../src/services/email.js';

describe('email templates', () => {
  it('builds verify email HTML with token link', () => {
    const html = buildVerifyEmailHtml('https://aegisdms.life', 'abc123');
    expect(html).toContain('abc123');
    expect(html).toContain('aegisdms.life');
    expect(html).toContain('verify');
  });

  it('builds reset password HTML with token link', () => {
    const html = buildResetPasswordHtml('https://aegisdms.life', 'reset456');
    expect(html).toContain('reset456');
    expect(html).toContain('aegisdms.life');
    expect(html).toContain('reset');
  });
});
