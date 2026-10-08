'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { isApiError, loginSchema, type LoginInput } from '@tidyr/shared';
import Link from 'next/link';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Banner } from '@/components/banner';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { applyFieldErrors, MESSAGES } from '@/lib/errors';
import { AuthCard } from './auth-card';
import { useAuth } from './auth-provider';
import { formAlertFor, type FormAlert } from './form-alert';
import { SessionBanner } from './session-banner';

export function LoginForm() {
  const { login } = useAuth();
  const [alert, setAlert] = useState<FormAlert | null>(null);
  const form = useForm({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });
  const { register, handleSubmit, setError, resetField, setFocus, formState } = form;

  async function onSubmit(values: LoginInput) {
    setAlert(null);
    try {
      // On success the (auth) layout sees the session and moves on to the dashboard.
      await login(values);
    } catch (error) {
      if (isApiError(error) && error.code === 'INVALID_CREDENTIALS') {
        setAlert({ tone: 'error', message: MESSAGES.invalidLogin });
        resetField('password');
        setFocus('password');
        return;
      }
      if (applyFieldErrors(error, setError, ['email', 'password'])) return;
      setAlert(formAlertFor(error));
    }
  }

  return (
    <AuthCard
      title="Log in to Tidyr"
      footer={
        <>
          New to Tidyr?{' '}
          <Link href="/register" className="font-medium text-brand-600 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <FormProvider {...form}>
        <form
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
          noValidate
          className="flex flex-col gap-4"
        >
          <SessionBanner />
          {alert ? <Banner tone={alert.tone}>{alert.message}</Banner> : null}
          <FormField<LoginInput> name="email" label="Email">
            {(control) => (
              <Input
                type="email"
                autoComplete="email"
                inputMode="email"
                {...register('email')}
                {...control}
              />
            )}
          </FormField>
          <FormField<LoginInput> name="password" label="Password">
            {(control) => (
              <Input
                type="password"
                autoComplete="current-password"
                {...register('password')}
                {...control}
              />
            )}
          </FormField>
          <Button type="submit" size="lg" className="mt-2 w-full" loading={formState.isSubmitting}>
            Log in
          </Button>
        </form>
      </FormProvider>
    </AuthCard>
  );
}
