export type DateValidationRule = 
  | 'no_past_dates'
  | 'no_future_dates'
  | 'expiry_after_manufacturing'
  | 'expiry_after_issue'
  | 'expiry_after_today'
  | 'reminder_not_past';

export interface DateValidationError {
  field: string;
  rule: DateValidationRule;
  message: string;
  value?: string;
}

export interface DateValidationResult {
  valid: boolean;
  errors: DateValidationError[];
}

function normalizeDate(date: string | Date | null | undefined): Date | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  return d;
}

function getToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function validateNoBackwardDate(
  date: string | Date | null | undefined,
  fieldName: string
): DateValidationError | null {
  const d = normalizeDate(date);
  if (!d) return null;
  
  const today = getToday();
  const dateOnly = stripTime(d);
  
  if (dateOnly < today) {
    return {
      field: fieldName,
      rule: 'no_past_dates',
      message: `${fieldName} cannot be earlier than today`,
      value: d.toISOString().split('T')[0],
    };
  }
  return null;
}

export function validateNoFutureDate(
  date: string | Date | null | undefined,
  fieldName: string
): DateValidationError | null {
  const d = normalizeDate(date);
  if (!d) return null;
  
  const today = getToday();
  const dateOnly = stripTime(d);
  
  if (dateOnly > today) {
    return {
      field: fieldName,
      rule: 'no_future_dates',
      message: `${fieldName} cannot be in the future`,
      value: d.toISOString().split('T')[0],
    };
  }
  return null;
}

export function validateExpiryAfterManufacturing(
  expiryDate: string | Date | null | undefined,
  manufacturingDate: string | Date | null | undefined,
  expiryFieldName: string = 'Expiry Date',
  manufacturingFieldName: string = 'Manufacturing Date'
): DateValidationError | null {
  const expiry = normalizeDate(expiryDate);
  const manufacturing = normalizeDate(manufacturingDate);
  
  if (!expiry || !manufacturing) return null;
  
  const expiryOnly = stripTime(expiry);
  const manufacturingOnly = stripTime(manufacturing);
  
  if (expiryOnly <= manufacturingOnly) {
    return {
      field: expiryFieldName,
      rule: 'expiry_after_manufacturing',
      message: `${expiryFieldName} must be greater than ${manufacturingFieldName}`,
      value: expiry.toISOString().split('T')[0],
    };
  }
  return null;
}

export function validateExpiryAfterIssue(
  expiryDate: string | Date | null | undefined,
  issueDate: string | Date | null | undefined,
  expiryFieldName: string = 'Expiry Date',
  issueFieldName: string = 'Issue Date'
): DateValidationError | null {
  const expiry = normalizeDate(expiryDate);
  const issue = normalizeDate(issueDate);
  
  if (!expiry || !issue) return null;
  
  const expiryOnly = stripTime(expiry);
  const issueOnly = stripTime(issue);
  
  if (expiryOnly <= issueOnly) {
    return {
      field: expiryFieldName,
      rule: 'expiry_after_issue',
      message: `${expiryFieldName} must be greater than ${issueFieldName}`,
      value: expiry.toISOString().split('T')[0],
    };
  }
  return null;
}

export function validateExpiryAfterToday(
  expiryDate: string | Date | null | undefined,
  fieldName: string = 'Expiry Date'
): DateValidationError | null {
  const expiry = normalizeDate(expiryDate);
  if (!expiry) return null;
  
  const today = getToday();
  const expiryOnly = stripTime(expiry);
  
  // Expiry must be STRICTLY greater than today (not equal)
  if (expiryOnly <= today) {
    return {
      field: fieldName,
      rule: 'expiry_after_today',
      message: `${fieldName} must be after today`,
      value: expiry.toISOString().split('T')[0],
    };
  }
  return null;
}

export interface TransactionDateValidation {
  invoiceDate?: string | Date | null;
  purchaseDate?: string | Date | null;
  quotationDate?: string | Date | null;
}

export function validateTransactionDates(data: TransactionDateValidation): DateValidationResult {
  const errors: DateValidationError[] = [];
  
  if (data.invoiceDate) {
    const error = validateNoBackwardDate(data.invoiceDate, 'Invoice Date');
    if (error) errors.push(error);
  }
  
  if (data.purchaseDate) {
    const error = validateNoBackwardDate(data.purchaseDate, 'Purchase Date');
    if (error) errors.push(error);
  }
  
  if (data.quotationDate) {
    const error = validateNoBackwardDate(data.quotationDate, 'Quotation Date');
    if (error) errors.push(error);
  }
  
  return { valid: errors.length === 0, errors };
}

export interface ProductDateValidation {
  manufacturingDate?: string | Date | null;
  expiryDate?: string | Date | null;
}

export function validateProductDates(data: ProductDateValidation): DateValidationResult {
  const errors: DateValidationError[] = [];
  
  if (data.manufacturingDate) {
    const futureError = validateNoFutureDate(data.manufacturingDate, 'Manufacturing Date');
    if (futureError) errors.push(futureError);
  }
  
  if (data.expiryDate) {
    const expiryTodayError = validateExpiryAfterToday(data.expiryDate, 'Expiry Date');
    if (expiryTodayError) errors.push(expiryTodayError);
    
    if (data.manufacturingDate) {
      const expiryMfgError = validateExpiryAfterManufacturing(
        data.expiryDate,
        data.manufacturingDate,
        'Expiry Date',
        'Manufacturing Date'
      );
      if (expiryMfgError) errors.push(expiryMfgError);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

export interface DocumentDateValidation {
  issueDate?: string | Date | null;
  expiryDate?: string | Date | null;
}

export function validateDocumentDates(data: DocumentDateValidation): DateValidationResult {
  const errors: DateValidationError[] = [];
  
  if (data.issueDate) {
    const futureError = validateNoFutureDate(data.issueDate, 'Issue Date');
    if (futureError) errors.push(futureError);
  }
  
  if (data.expiryDate) {
    const expiryTodayError = validateExpiryAfterToday(data.expiryDate, 'Expiry Date');
    if (expiryTodayError) errors.push(expiryTodayError);
    
    if (data.issueDate) {
      const expiryIssueError = validateExpiryAfterIssue(
        data.expiryDate,
        data.issueDate,
        'Expiry Date',
        'Issue Date'
      );
      if (expiryIssueError) errors.push(expiryIssueError);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

export interface ReminderDateValidation {
  reminderDate?: string | Date | null;
  dueDate?: string | Date | null;
}

export function validateReminderDates(data: ReminderDateValidation): DateValidationResult {
  const errors: DateValidationError[] = [];
  
  if (data.reminderDate) {
    const error = validateNoBackwardDate(data.reminderDate, 'Reminder Date');
    if (error) errors.push(error);
  }
  
  if (data.dueDate) {
    const error = validateNoBackwardDate(data.dueDate, 'Due Date');
    if (error) errors.push(error);
  }
  
  return { valid: errors.length === 0, errors };
}

export interface ProjectDateValidation {
  startDate?: string | Date | null;
  endDate?: string | Date | null;
}

export function validateProjectDates(data: ProjectDateValidation): DateValidationResult {
  const errors: DateValidationError[] = [];
  
  if (data.endDate && data.startDate) {
    const start = normalizeDate(data.startDate);
    const end = normalizeDate(data.endDate);
    
    if (start && end && stripTime(end) < stripTime(start)) {
      errors.push({
        field: 'End Date',
        rule: 'expiry_after_issue',
        message: 'End Date must be on or after Start Date',
        value: end.toISOString().split('T')[0],
      });
    }
  }
  
  return { valid: errors.length === 0, errors };
}

export function getTodayString(): string {
  return getToday().toISOString().split('T')[0];
}

export function getMinExpiryDate(manufacturingOrIssueDate?: string | Date | null): string {
  const today = getToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const reference = normalizeDate(manufacturingOrIssueDate);
  
  // Expiry must be after both today AND manufacturing/issue date
  if (reference) {
    const refDate = stripTime(reference);
    const dayAfterRef = new Date(refDate);
    dayAfterRef.setDate(dayAfterRef.getDate() + 1);
    
    // Return whichever is later: tomorrow or day after reference
    return dayAfterRef > tomorrow 
      ? dayAfterRef.toISOString().split('T')[0]
      : tomorrow.toISOString().split('T')[0];
  }
  
  return tomorrow.toISOString().split('T')[0];
}

export function getMaxManufacturingDate(): string {
  return getTodayString();
}

export function getMinTransactionDate(): string {
  return getTodayString();
}
