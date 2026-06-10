import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// Styled native <select> — keyboard/screen-reader friendly with no extra deps.
export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative inline-flex w-full">
      <select
        ref={ref}
        className={cn(
          'flex h-10 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
})
