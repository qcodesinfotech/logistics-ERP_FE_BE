import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { isDateDisabled } from "@/hooks/use-date-validation";

export type DateValidationType = 'transaction' | 'manufacturing' | 'expiry' | 'issue' | 'reminder' | 'none';

interface ValidatedDatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  validationType?: DateValidationType;
  referenceDate?: Date;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
}

export function ValidatedDatePicker({
  value,
  onChange,
  validationType = 'none',
  referenceDate,
  placeholder = "Pick a date",
  className,
  disabled = false,
  error,
}: ValidatedDatePickerProps) {
  const today = React.useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const disabledDays = React.useMemo(() => {
    if (validationType === 'none') return undefined;
    
    return (date: Date) => isDateDisabled(date, validationType as any, referenceDate);
  }, [validationType, referenceDate]);

  const fromDate = React.useMemo(() => {
    if (validationType === 'transaction' || validationType === 'reminder') {
      return today;
    }
    if (validationType === 'expiry') {
      // Expiry must be strictly after today (tomorrow at minimum)
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      if (referenceDate) {
        const dayAfterRef = new Date(referenceDate);
        dayAfterRef.setDate(dayAfterRef.getDate() + 1);
        return dayAfterRef > tomorrow ? dayAfterRef : tomorrow;
      }
      return tomorrow;
    }
    return undefined;
  }, [validationType, referenceDate, today]);

  const toDate = React.useMemo(() => {
    if (validationType === 'manufacturing' || validationType === 'issue') {
      return today;
    }
    return undefined;
  }, [validationType, today]);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground",
              error && "border-red-500"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "PPP") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            disabled={disabledDays}
            fromDate={fromDate}
            toDate={toDate}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}

interface ValidatedDateInputProps {
  value?: string;
  onChange: (value: string) => void;
  validationType?: DateValidationType;
  referenceDate?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
}

export function ValidatedDateInput({
  value,
  onChange,
  validationType = 'none',
  referenceDate,
  className,
  disabled = false,
  error,
}: ValidatedDateInputProps) {
  const today = React.useMemo(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }, []);

  const minDate = React.useMemo(() => {
    if (validationType === 'transaction' || validationType === 'reminder') {
      return today;
    }
    if (validationType === 'expiry') {
      // Expiry must be strictly after today (tomorrow at minimum)
      const todayDate = new Date(today);
      const tomorrow = new Date(todayDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      if (referenceDate && referenceDate >= today) {
        const ref = new Date(referenceDate);
        ref.setDate(ref.getDate() + 1);
        const dayAfterRefStr = ref.toISOString().split('T')[0];
        return dayAfterRefStr > tomorrowStr ? dayAfterRefStr : tomorrowStr;
      }
      return tomorrowStr;
    }
    return undefined;
  }, [validationType, referenceDate, today]);

  const maxDate = React.useMemo(() => {
    if (validationType === 'manufacturing' || validationType === 'issue') {
      return today;
    }
    return undefined;
  }, [validationType, today]);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <input
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        min={minDate}
        max={maxDate}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-red-500",
          className
        )}
      />
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
