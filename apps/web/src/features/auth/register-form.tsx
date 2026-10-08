'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { isApiError, registerFormSchema, type RegisterFormInput } from '@tidyr/shared';
import Link from 'next/link';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Banner } from '@/components/banner';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { applyFieldErrors, MESSAGES } from '@/lib/errors';
import { firstName } from '@/lib/names';
import { AuthCard } from './auth-card';
import { useAuth } from './auth-provider';
import { formAlertFor, type FormAlert } from './form-alert';

export function RegisterForm() {
  const { register: signUp } = useAuth();
  const [alert, setAlert] = useState<FormAlert | null>(null);
  const form = useForm({
    resolver: zodResolver(registerFormSchema),
    mode: 'onTouched',
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });
  const { register, handleSubmit, setError, formState } = form;

  async function onSubmit({ confirmPassword: _confirm, ...values }: RegisterFormInput) {
    setAlert(null);
    try {
      const user = await signUp(values);
      toast.success(`Welcome to Tidyr, ${firstName(user.fullName)}!`);
    } catch (error) {
      if (isApiError(error) && error.code === 'EMAIL_TAKEN') {
        setError('email', { type: 'server', message: MESSAGES.emailTaken }, { shouldFocus: true });
        return;
      }
      if (applyFieldErrors(error, setError, ['fullName', 'email', 'password'])) return;
      setAlert(formAlertFor(error));
    }
  }

  return (
    <AuthCard
      title="Create your account"
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Log in
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
          {alert ? <Banner tone={alert.tone}>{alert.message}</Banner> : null}
          <FormField<RegisterFormInput> name="fullName" label="Full name">
            {(control) => <Input autoComplete="name" {...register('fullName')} {...control} />}
          </FormField>
          <FormField<RegisterFormInput> name="email" label="Email">
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
          <FormField<RegisterFormInput>
            name="password"
            label="Password"
            hint="At least 8 characters, with a letter and a number."
          >
            {(control) => (
              <Input
                type="password"
                autoComplete="new-password"
                {...register('password')}
                {...control}
              />
            )}
          </FormField>
          <FormField<RegisterFormInput> name="confirmPassword" label="Confirm password">
            {(control) => (
              <Input
                type="password"
                autoComplete="new-password"
                {...register('confirmPassword')}
                {...control}
              />
            )}
          </FormField>
          <Button type="submit" size="lg" className="mt-2 w-full" loading={formState.isSubmitting}>
            Create account
          </Button>
        </form>
      </FormProvider>
    </AuthCard>
  );
}
