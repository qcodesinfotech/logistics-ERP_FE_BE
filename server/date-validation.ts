import { Request, Response, NextFunction } from 'express';
import {
  validateTransactionDates,
  validateProductDates,
  validateDocumentDates,
  validateReminderDates,
  validateProjectDates,
  DateValidationResult,
  DateValidationError,
} from '@shared/date-validation';

export interface DateValidationLogEntry {
  module: string;
  field: string;
  invalidValue: string | undefined;
  rule: string;
  userId?: string;
  timestamp: Date;
  message: string;
}

const validationLogs: DateValidationLogEntry[] = [];

function logValidationFailure(
  module: string,
  errors: DateValidationError[],
  userId?: string
): void {
  for (const error of errors) {
    const entry: DateValidationLogEntry = {
      module,
      field: error.field,
      invalidValue: error.value,
      rule: error.rule,
      userId,
      timestamp: new Date(),
      message: error.message,
    };
    validationLogs.push(entry);
    console.warn(`[DATE VALIDATION FAILED] Module: ${module}, Field: ${error.field}, Value: ${error.value}, Rule: ${error.rule}, Message: ${error.message}`);
  }
}

export function getValidationLogs(): DateValidationLogEntry[] {
  return [...validationLogs];
}

export function clearValidationLogs(): void {
  validationLogs.length = 0;
}

function sendValidationError(res: Response, result: DateValidationResult): Response {
  return res.status(400).json({
    error: 'Date validation failed',
    details: result.errors.map(e => ({
      field: e.field,
      message: e.message,
    })),
  });
}

export function validateTransactionDatesMiddleware(module: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const body = req.body;
    const result = validateTransactionDates({
      invoiceDate: body.invoiceDate || body.saleDate,
      purchaseDate: body.purchaseDate || body.date,
      quotationDate: body.quotationDate || body.date,
    });

    if (!result.valid) {
      const userId = (req as any).user?.id;
      logValidationFailure(module, result.errors, userId);
      return sendValidationError(res, result);
    }

    next();
  };
}

export function validateProductDatesMiddleware(module: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const body = req.body;
    const result = validateProductDates({
      manufacturingDate: body.manufacturingDate || body.mfgDate,
      expiryDate: body.expiryDate || body.expDate,
    });

    if (!result.valid) {
      const userId = (req as any).user?.id;
      logValidationFailure(module, result.errors, userId);
      return sendValidationError(res, result);
    }

    next();
  };
}

export function validateDocumentDatesMiddleware(module: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const body = req.body;
    
    let parsedData = body;
    if (body.data && typeof body.data === 'string') {
      try {
        parsedData = JSON.parse(body.data);
      } catch {
        parsedData = body;
      }
    }
    
    const result = validateDocumentDates({
      issueDate: parsedData.issueDate,
      expiryDate: parsedData.expiryDate,
    });

    if (!result.valid) {
      const userId = (req as any).user?.id;
      logValidationFailure(module, result.errors, userId);
      return sendValidationError(res, result);
    }

    next();
  };
}

export function validateReminderDatesMiddleware(module: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const body = req.body;
    const result = validateReminderDates({
      reminderDate: body.reminderDate || body.nextDueDate,
      dueDate: body.dueDate,
    });

    if (!result.valid) {
      const userId = (req as any).user?.id;
      logValidationFailure(module, result.errors, userId);
      return sendValidationError(res, result);
    }

    next();
  };
}

export function validateProjectDatesMiddleware(module: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const body = req.body;
    const result = validateProjectDates({
      startDate: body.startDate,
      endDate: body.endDate,
    });

    if (!result.valid) {
      const userId = (req as any).user?.id;
      logValidationFailure(module, result.errors, userId);
      return sendValidationError(res, result);
    }

    next();
  };
}

export function validateBulkUploadDates(
  rows: any[],
  validateFn: (row: any) => DateValidationResult
): { validRows: any[]; invalidRows: { row: number; errors: DateValidationError[] }[] } {
  const validRows: any[] = [];
  const invalidRows: { row: number; errors: DateValidationError[] }[] = [];

  rows.forEach((row, index) => {
    const result = validateFn(row);
    if (result.valid) {
      validRows.push(row);
    } else {
      invalidRows.push({ row: index + 1, errors: result.errors });
    }
  });

  return { validRows, invalidRows };
}

export function validateProductBulkUpload(rows: any[]): { validRows: any[]; invalidRows: { row: number; errors: DateValidationError[] }[] } {
  return validateBulkUploadDates(rows, (row) => {
    return validateProductDates({
      manufacturingDate: row.manufacturingDate || row['Manufacturing Date'] || row.mfgDate,
      expiryDate: row.expiryDate || row['Expiry Date'] || row.expDate,
    });
  });
}

export function validateDocumentBulkUpload(rows: any[]): { validRows: any[]; invalidRows: { row: number; errors: DateValidationError[] }[] } {
  return validateBulkUploadDates(rows, (row) => {
    return validateDocumentDates({
      issueDate: row.issueDate || row['Issue Date'],
      expiryDate: row.expiryDate || row['Expiry Date'],
    });
  });
}
