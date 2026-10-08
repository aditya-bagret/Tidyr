import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import { Loader2Icon } from 'lucide-react';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';

// DESIGN §3: variants primary / secondary (outline) / ghost / danger; sizes sm 32 · md 40 · lg 44.
const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent text-sm font-semibold whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 aria-busy:opacity-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-neutral-0 hover:bg-brand-700 active:bg-brand-700',
        secondary:
          'border-neutral-200 bg-neutral-0 text-neutral-900 hover:bg-neutral-100 aria-expanded:bg-neutral-100',
        ghost: 'text-neutral-900 hover:bg-neutral-100 aria-expanded:bg-neutral-100',
        danger: 'bg-danger-600 text-neutral-0 hover:bg-danger-600/90',
        link: 'h-auto px-0 text-brand-600 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-10 px-4',
        lg: 'h-11 px-5',
        icon: 'size-10',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows a spinner, keeps the button's width and disables it. */
    loading?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return (
      <Slot.Root data-slot="button" className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-2">{children}</span>
          <Loader2Icon className="absolute animate-spin" aria-hidden />
        </>
      ) : (
        children
      )}
    </button>
  );
}

export { Button, buttonVariants };
