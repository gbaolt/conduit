import { Button } from '@conduit/ui/components/button';
import { Input } from '@conduit/ui/components/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@conduit/ui/components/input-group';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from '@/lib/utils';

import type { FormControlFn } from './form-base';
import { FormBase } from './form-base';

export const FormInput: FormControlFn<
  Omit<ComponentPropsWithoutRef<typeof Input>, 'children'> & {
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
  descPosition,
  orientation,
  ...inputProps
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
          <Input {...field} {...inputProps} />
          {children}
        </div>
      )}
    </FormBase>
  );
};

export const FormInputGroup: FormControlFn<
  Omit<ComponentPropsWithoutRef<typeof Input>, 'children'> & {
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
  orientation,
  descPosition,
  leftAddon,
  rightAddon,
  ...inputProps
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
          <InputGroup className="min-h-10!">
            {leftAddon && <InputGroupAddon>{leftAddon}</InputGroupAddon>}
            <InputGroupInput {...field} {...inputProps} />
            {rightAddon && (
              <InputGroupAddon align="inline-end">{rightAddon}</InputGroupAddon>
            )}
          </InputGroup>
          {children}
        </div>
      )}
    </FormBase>
  );
};

export const FormNumberInput: FormControlFn<
  Omit<ComponentPropsWithoutRef<typeof Input>, 'children'> & {
    step?: number;
    min?: number;
    max?: number;
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
  descPosition,
  orientation,
  step = 1,
  min,
  max,
  ...inputProps
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
      {(field) => {
        const handleIncrement = () => {
          const newValue = (field.value || 0) + step;
          if (max === undefined || newValue <= max) {
            field.onChange(newValue);
          }
        };

        const handleDecrement = () => {
          const newValue = (field.value || 0) - step;
          if (min === undefined || newValue >= min) {
            field.onChange(newValue);
          }
        };
        return (
          <div className={cn('flex', itemClassName)}>
            <div className="relative w-full">
              <Input
                type="number"
                {...field}
                {...inputProps}
                onChange={(e) => {
                  const value =
                    e.target.value === '' ? 0 : Number(e.target.value);
                  field.onChange(value);
                }}
                step={step}
                min={min}
                max={max}
                className={cn(
                  '[appearance:textfield] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                  inputProps.className
                )}
              />
              <div className="absolute top-1/4 right-0 flex h-1/2 -translate-y-1/2 flex-col">
                <Button
                  type="button"
                  variant="outline"
                  className="h-full w-5 rounded-b-none p-0 [&]:rounded-tl-none!"
                  onClick={handleIncrement}
                  disabled={max !== undefined && (field.value || 0) >= max}
                >
                  <IconChevronUp className="size-3" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-full w-5 rounded-t-none p-0 [&]:rounded-bl-none!"
                  style={{ borderBottomLeftRadius: 0 }}
                  onClick={handleDecrement}
                  disabled={min !== undefined && (field.value || 0) <= min}
                >
                  <IconChevronDown className="size-3" />
                </Button>
              </div>
            </div>
            {children}
          </div>
        );
      }}
    </FormBase>
  );
};

export const FormFileInput: FormControlFn<{
  children: (props: {
    value: string;
    onChange: (url: string) => void;
  }) => ReactNode;
  itemClassName?: string;
}> = ({
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
        <div className={cn('flex flex-col', itemClassName)}>
          {children({
            value: field.value as string,
            onChange: (url: string) => field.onChange(url),
          })}
        </div>
      )}
    </FormBase>
  );
};
