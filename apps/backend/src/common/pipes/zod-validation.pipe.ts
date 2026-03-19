import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ZodError, ZodIssueCode, type ZodTypeAny } from 'zod';

@Injectable()
export class ZodValidationPipe<TSchema extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  async transform(value: unknown, metadata: ArgumentMetadata) {
    try {
      return await this.schema.parseAsync(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message: this.formatIssues(error),
          source: metadata.type,
        });
      }

      throw error;
    }
  }

  private formatIssues(error: ZodError): string[] {
    return error.issues.flatMap((issue) => {
      if (issue.code === ZodIssueCode.unrecognized_keys) {
        const basePath = issue.path.length > 0 ? `${issue.path.join('.')}.` : '';
        return issue.keys.map((key) => `property ${basePath}${key} should not exist`);
      }

      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return [`${path}${issue.message}`];
    });
  }
}
