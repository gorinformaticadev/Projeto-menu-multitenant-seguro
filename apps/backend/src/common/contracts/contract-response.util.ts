import { InternalServerErrorException, Logger } from '@nestjs/common';
import { ZodError, type ZodTypeAny } from 'zod';

const logger = new Logger('ContractResponse');

type ContractResponseOptions = {
  skipProductionValidation?: boolean;
  productionValidator?: (value: unknown) => void;
};

export function assertContractResponse<TSchema extends ZodTypeAny>(
  schema: TSchema,
  value: unknown,
  context: string,
  options: ContractResponseOptions = {},
) {
  const shouldSkipProductionValidation =
    options.skipProductionValidation === true &&
    process.env.NODE_ENV === 'production' &&
    process.env.ENABLE_RUNTIME_RESPONSE_CONTRACT_VALIDATION !== 'true';

  if (shouldSkipProductionValidation) {
    return value as ReturnType<TSchema['parse']>;
  }

  const shouldUseProductionValidator =
    typeof options.productionValidator === 'function' &&
    process.env.NODE_ENV === 'production' &&
    process.env.ENABLE_RUNTIME_RESPONSE_CONTRACT_VALIDATION !== 'true';

  if (shouldUseProductionValidator) {
    try {
      options.productionValidator?.(value);
      return value as ReturnType<TSchema['parse']>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Contract response production validation failed for ${context}: ${message}`);
      throw new InternalServerErrorException(`Contract response validation failed for ${context}`);
    }
  }

  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.error(
        `Contract response validation failed for ${context}: ${error.issues
          .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
          .join('; ')}`,
      );
      throw new InternalServerErrorException(`Contract response validation failed for ${context}`);
    }

    throw error;
  }
}
