import { useMemo } from 'react';
import {
  validateTransactionDates,
  validateProductDates,
  validateDocumentDates,
  validateReminderDates,
  validateProjectDates,
  getTodayString,
  getMinExpiryDate,
  getMaxManufacturingDate,
  getMinTransactionDate,
  DateValidationResult,
} from '@shared/date-validation';

export function useDateValidation() {
  const today = useMemo(() => getTodayString(), []);
  
  return {
    today,
    getMinExpiryDate,
    getMaxManufacturingDate: () => getMaxManufacturingDate(),
    getMinTransactionDate: () => getMinTransactionDate(),
    validateTransactionDates,
    validateProductDates,
    validateDocumentDates,
    validateReminderDates,
    validateProjectDates,
  };
}

export function getDatePickerConstraints(type: 'transaction' | 'manufacturing' | 'expiry' | 'issue' | 'reminder' | 'project_start' | 'project_end', referenceDate?: string) {
  const today = getTodayString();
  const tomorrow = getMinExpiryDate(); // Always returns tomorrow as minimum for expiry
  
  switch (type) {
    case 'transaction':
      return { min: today, max: undefined };
    case 'manufacturing':
      return { min: undefined, max: today };
    case 'expiry':
      // Expiry must be strictly after today (tomorrow minimum)
      // If reference date provided, use day after reference if later than tomorrow
      if (referenceDate) {
        const minFromRef = getMinExpiryDate(referenceDate);
        return { min: minFromRef > tomorrow ? minFromRef : tomorrow, max: undefined };
      }
      return { min: tomorrow, max: undefined };
    case 'issue':
      return { min: undefined, max: today };
    case 'reminder':
      return { min: today, max: undefined };
    case 'project_start':
      return { min: undefined, max: undefined };
    case 'project_end':
      return { min: undefined, max: undefined };
    default:
      return { min: undefined, max: undefined };
  }
}

export function isDateDisabled(date: Date, type: 'transaction' | 'manufacturing' | 'expiry' | 'issue' | 'reminder', referenceDate?: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  
  switch (type) {
    case 'transaction':
    case 'reminder':
      return checkDate < today;
    case 'manufacturing':
    case 'issue':
      return checkDate > today;
    case 'expiry':
      // Expiry must be strictly after today (not equal to today)
      if (checkDate <= today) return true;
      if (referenceDate) {
        const refDate = new Date(referenceDate);
        refDate.setHours(0, 0, 0, 0);
        return checkDate <= refDate;
      }
      return false;
    default:
      return false;
  }
}

export function formatDateValidationErrors(result: DateValidationResult): string[] {
  return result.errors.map(e => e.message);
}
