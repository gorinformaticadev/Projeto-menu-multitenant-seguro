import { 
  ValidatorConstraint, 
  ValidatorConstraintInterface, 
  ValidationArguments,
  registerDecorator,
  ValidationOptions
} from 'class-validator';

/**
 * Validador para prevenir injeção de tenantId malicioso
 * Garante que tenantId no payload seja consistente com o usuário autenticado
 */
@ValidatorConstraint({ name: 'validTenantId', async: false })
export class ValidTenantIdValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any;
    const userTenantId = object.user?.tenantId;
    const userRole = object.user?.role;
    
    // Se não tem usuário autenticado, deixar outros guards lidarem
    if (!userTenantId) {
      return true;
    }
    
    // SUPER_ADMIN pode usar qualquer tenantId
    if (userRole === 'SUPER_ADMIN') {
      return typeof value === 'string' && value.length > 0;
    }
    
    // Para usuários normais, tenantId deve bater exatamente
    return value === userTenantId;
  }

  defaultMessage(args: ValidationArguments) {
    return `tenantId inválido ou não autorizado`;
  }
}

/**
 * Decorator para validar tenantId em DTOs
 */
export function IsValidTenantId(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: ValidTenantIdValidator,
    });
  };
}

/**
 * Validador para prevenir enumeração de IDs
 * Garante que IDs sigam padrões UUID válidos
 */
@ValidatorConstraint({ name: 'validUuidFormat', async: false })
export class ValidUuidFormatValidator implements ValidatorConstraintInterface {
  validate(value: any) {
    if (!value) return false;
    
    // Aceitar string ou array de strings
    const values = Array.isArray(value) ? value : [value];
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    return values.every(id => 
      typeof id === 'string' && 
      id.length > 0 && 
      uuidRegex.test(id)
    );
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} deve conter UUID(s) válido(s)`;
  }
}

/**
 * Decorator para validar formato UUID
 */
export function IsValidUuid(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: ValidUuidFormatValidator,
    });
  };
}

/**
 * Validador para prevenir payloads excessivamente grandes
 * Protege contra ataques de overflow e DoS
 */
@ValidatorConstraint({ name: 'reasonablePayloadSize', async: false })
export class ReasonablePayloadSizeValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const maxSize = args.constraints[0] || 10000; // 10KB por padrão
    
    if (!value) return true;
    
    try {
      const jsonString = JSON.stringify(value);
      return Buffer.byteLength(jsonString, 'utf8') <= maxSize;
    } catch {
      return false; // Se não conseguir serializar, considerar inválido
    }
  }

  defaultMessage(args: ValidationArguments) {
    const maxSize = args.constraints[0] || 10000;
    return `Payload excede o tamanho máximo permitido (${maxSize} bytes)`;
  }
}

/**
 * Decorator para limitar tamanho de payloads
 */
export function HasReasonableSize(maxSize?: number, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [maxSize],
      validator: ReasonablePayloadSizeValidator,
    });
  };
}