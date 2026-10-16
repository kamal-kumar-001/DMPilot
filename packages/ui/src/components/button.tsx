import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-primary to-accent-cyan text-white shadow-brand hover:shadow-brand-lg hover:opacity-95 border-0',
        secondary: 'bg-white/10 hover:bg-white/15 border border-white/10 text-white shadow-sm',
        outline:
          'border border-white/15 bg-transparent text-gray-200 hover:bg-white/10 hover:text-white',
        ghost: 'text-gray-400 hover:bg-white/10 hover:text-white',
        link: 'text-primary underline-offset-4 hover:underline p-0 h-auto',
        destructive: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm border-0',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-12 rounded-xl px-7 text-base font-bold',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
