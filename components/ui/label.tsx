import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Renders a red asterisk after the label text. */
  required?: boolean
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, required, children, ...props },
  ref
) {
  return (
    <label
      ref={ref}
      className={cn('text-sm font-medium leading-none text-foreground', className)}
      {...props}
    >
      {children}
      {required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
    </label>
  )
})
