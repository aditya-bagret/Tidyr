import { ApiError } from '@tidyr/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from '@/features/auth/login-form';

const { login } = vi.hoisted(() => ({ login: vi.fn() }));

// The form only needs `login` from the provider; booting a real AuthProvider would call the API.
vi.mock('@/features/auth/auth-provider', () => ({ useAuth: () => ({ login }) }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

function setup() {
  const user = userEvent.setup();
  render(<LoginForm />);
  return {
    user,
    email: screen.getByLabelText('Email'),
    password: screen.getByLabelText('Password'),
    submit: screen.getByRole('button', { name: 'Log in' }),
  };
}

beforeEach(() => {
  login.mockReset();
});

describe('LoginForm validation (T-WEB-01)', () => {
  it('shows field errors, focuses the first invalid field and never calls the API', async () => {
    const { user, email, password, submit } = setup();

    await user.click(submit);

    expect(login).not.toHaveBeenCalled();
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(password.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(email);
    // DESIGN §6: the error text is linked to its input.
    const emailError = document.getElementById(email.getAttribute('aria-describedby') ?? '');
    expect(emailError?.textContent).toBe('Enter a valid email');
    const passwordError = document.getElementById(password.getAttribute('aria-describedby') ?? '');
    expect(passwordError?.textContent).toBe('Required');
  });

  it('validates a touched field on blur', async () => {
    const { user, email } = setup();

    await user.type(email, 'not-an-email');
    await user.tab();

    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Enter a valid email')).toBeTruthy();
  });

  it('submits the values parsed by the shared schema', async () => {
    login.mockResolvedValue({ id: 'u1' });
    const { user, email, password, submit } = setup();

    await user.type(email, '  Demo@Tidyr.TEST ');
    await user.type(password, 'Demo@12345');
    await user.click(submit);

    expect(login).toHaveBeenCalledWith({ email: 'demo@tidyr.test', password: 'Demo@12345' });
  });
});

describe('LoginForm API errors (T-WEB-02)', () => {
  it('shows the invalid-login banner and clears the password', async () => {
    login.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.'));
    const { user, email, password, submit } = setup();

    await user.type(email, 'demo@tidyr.test');
    await user.type(password, 'wrong-pass1');
    await user.click(submit);

    expect((await screen.findByRole('alert')).textContent).toBe('Invalid email or password.');
    expect((password as HTMLInputElement).value).toBe('');
    expect(document.activeElement).toBe(password);
  });

  it('shows the wait from Retry-After when rate limited', async () => {
    login.mockRejectedValue(
      new ApiError(429, 'RATE_LIMITED', 'Too many requests', { retryAfter: 540 }),
    );
    const { user, email, password, submit } = setup();

    await user.type(email, 'demo@tidyr.test');
    await user.type(password, 'Demo@12345');
    await user.click(submit);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Too many attempts. Try again in 9 minutes.',
    );
  });
});
