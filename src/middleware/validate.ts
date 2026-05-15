import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        res.status(400).json({
          status: 'fail',
          message: 'Validation failed',
          errors: formattedErrors,
        });
        return;
      }
      next(error);
    }
  };
};

export default validate;
