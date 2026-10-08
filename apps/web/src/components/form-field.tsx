'use client';

import { cn } from 'cn';
import { AlertCircleIcon } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useFormContext, type FieldValues, type Path } from 'react-hook-form';
import { Label } from '@/components/ui/label';

/** Spread onto the control so the label, error and hint are wired up for assistive tech. */
export interface FieldControlProps {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}

interface FormFieldProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  hint?: string;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/** Label + control + error (DESIGN §3). Reads the field's error from the surrounding <FormProvider>. */
export function FormField<T extends FieldValues>({
  name,
  label,
  hint,
  className,
  children,
}: FormFieldProps<T>) {
  const { getFieldState, formState } = useFormContext<T>();
  const { error } = getFieldState(name, formState);
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} className="font-medium text-neutral-900">
        {label}
      </Label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy || undefined,
      })}
      {error?.message ? (
        <p id={errorId} className="flex items-center gap-1 text-xs text-danger-600">
          <AlertCircleIcon className="size-3.5 shrink-0" aria-hidden />
          {error.message}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-xs text-neutral-600">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
