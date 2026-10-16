import * as React from 'react';
import { cn } from '../utils';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => {
  return (
    <label
      ref={ref}
      className={cn(
        'text-xs font-semibold uppercase tracking-wider text-slate-700 select-none',
        className,
      )}
      {...props}
    />
  );
});
Label.displayName = 'Label';

export { Label };
