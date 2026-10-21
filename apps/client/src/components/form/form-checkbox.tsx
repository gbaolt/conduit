import { Checkbox } from '@conduit/ui/components/checkbox';

import type { FormControlFn } from './form-base';
import { FormBase } from './form-base';

export const FormCheckbox: FormControlFn<{
  fieldClassName?: string;
  orientation?: 'horizontal' | 'vertical' | 'responsive' | null;
}> = ({ fieldClassName, orientation = 'horizontal', ...props }) => {
  return (
    <FormBase
      {...props}
      controlFirst
      className={fieldClassName}
      orientation={orientation}
    >
      {({ onChange, value, ...field }) => (
        <Checkbox
          {...field}
          checked={value ?? false}
          onCheckedChange={onChange}
        />
      )}
    </FormBase>
  );
};
