import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from '@conduit/ui/components/select';
import type { ComponentProps, ReactNode } from 'react';

import type { FormControlFn } from './form-base';
import { FormBase } from './form-base';

export const FormSelect: FormControlFn<{
  children: ReactNode;
  /** Value to label map, so the trigger shows the label instead of the raw value. */
  items?: ComponentProps<typeof Select>['items'];
  fieldClassName?: string;
  className?: string;
  placeholder?: string;
  size?: ComponentProps<typeof SelectTrigger>['size'];
  orientation?: 'horizontal' | 'vertical' | 'responsive' | null;
}> = ({
  children,
  items,
  fieldClassName,
  className,
  orientation,
  placeholder,
  size,
  ...props
}) => {
  return (
    <FormBase {...props} className={fieldClassName} orientation={orientation}>
      {({ onChange, onBlur, value, name, disabled, ref, ...field }) => (
        <Select
          items={items}
          name={name}
          value={value}
          disabled={disabled}
          inputRef={ref}
          onValueChange={onChange}
        >
          <SelectTrigger
            aria-invalid={field['aria-invalid']}
            id={field.id}
            onBlur={onBlur}
            size={size}
            className={className}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>{children}</SelectContent>
        </Select>
      )}
    </FormBase>
  );
};
