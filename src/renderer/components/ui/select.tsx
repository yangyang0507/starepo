/**
 * Select 组件
 */

import React from 'react';
import { cn } from '@/lib/utils';

// SelectProps 未在此模块中使用，但保留以供扩展
// interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
//   placeholder?: string;
// }

interface SelectTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

interface SelectValueProps {
  placeholder?: string;
}

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

interface SelectItemProps extends React.OptionHTMLAttributes<HTMLOptionElement> {
  value: string;
  children?: React.ReactNode;
}

// Simple Select wrapper - returns a custom select component pattern
const Select = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return <div className="relative inline-block w-full">{children}</div>;
};

const SelectTrigger = React.forwardRef<HTMLDivElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('relative w-full', className)} {...props}>
      {children}
    </div>
  )
);
SelectTrigger.displayName = 'SelectTrigger';

const SelectValue = React.forwardRef<HTMLDivElement, SelectValueProps>(
  ({ placeholder, ...props }, ref) => (
    <div ref={ref} {...props}>
      {placeholder}
    </div>
  )
);
SelectValue.displayName = 'SelectValue';

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md z-50',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
SelectContent.displayName = 'SelectContent';

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, _value, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'px-3 py-2 hover:bg-accent cursor-pointer text-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
SelectItem.displayName = 'SelectItem';

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
