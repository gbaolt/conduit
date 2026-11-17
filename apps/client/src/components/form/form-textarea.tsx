import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from '@conduit/ui/components/input-group';
import { Textarea } from '@conduit/ui/components/textarea';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from '@/lib/utils';

import type { FormControlFn } from './form-base';
import { FormBase } from './form-base';

export const FormTextarea: FormControlFn<
  Omit<ComponentPropsWithoutRef<typeof Textarea>, 'children'> & {
    children?: ReactNode;
    itemClassName?: string;
  }
> = ({
  children,
  control,
  name,
  label,
  description,
  labelAction,
  fieldClassName,
  itemClassName,
  orientation,
  descPosition,
  ...textareaProps
}) => {
  return (
    <FormBase
      control={control}
      name={name}
      label={label}
      description={description}
      labelAction={labelAction}
      className={fieldClassName}
      orientation={orientation}
      descPosition={descPosition}
    >
      {(field) => (
        <div className={cn('flex', itemClassName)}>
          <Textarea {...field} {...textareaProps} />
          {children}
        </div>
      )}
    </FormBase>
  );
};

export const FormTextareaGroup: FormControlFn<
  Omit<ComponentPropsWithoutRef<typeof Textarea>, 'children'> & {
    children?: ReactNode;
    leftAddon?: ReactNode;
    rightAddon?: ReactNode;
    itemClassName?: string;
  }
> = ({
  children,
  control,
  name,
  label,
  description,
  labelAction,
  fieldClassName,
  itemClassName,
  descPosition,
  orientation,
  leftAddon,
  rightAddon,
  ...textareaProps
}) => {
  return (
    <FormBase
      control={control}
      name={name}
      label={label}
      description={description}
      labelAction={labelAction}
      className={fieldClassName}
      orientation={orientation}
      descPosition={descPosition}
    >
      {(field) => (
        <div className={cn('flex', itemClassName)}>
          <InputGroup>
            {leftAddon && <InputGroupAddon>{leftAddon}</InputGroupAddon>}
            <InputGroupTextarea {...field} {...textareaProps} />
            {rightAddon && (
              <InputGroupAddon align="block-end">{rightAddon}</InputGroupAddon>
            )}
          </InputGroup>
          {children}
        </div>
      )}
    </FormBase>
  );
};
