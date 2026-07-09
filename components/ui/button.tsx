import { cn } from '@/lib/utils'

const VARIANT_CLASSES: Record<string, string> = {
  default: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'bg-secondary text-secondary-foreground hover:opacity-90',
  outline: 'border border-input bg-transparent hover:bg-muted',
  ghost: 'bg-transparent hover:bg-muted',
  destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
}

const SIZE_CLASSES: Record<string, string> = {
  default: 'h-9 px-4 text-sm',
  sm: 'h-8 px-3 text-sm',
  lg: 'h-11 px-6 text-sm',
  icon: 'h-9 w-9',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANT_CLASSES
  size?: keyof typeof SIZE_CLASSES
}

export function Button({ className, variant = 'default', size = 'default', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-[transform,background-color,opacity,box-shadow] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    />
  )
}
