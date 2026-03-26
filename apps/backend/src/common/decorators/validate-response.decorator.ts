import { SetMetadata } from '@nestjs/common';

export const VALIDATE_RESPONSE_KEY = 'validateResponse';

/**
 * Decorator para habilitar a validação automática da resposta contra um DTO.
 * @param dto O DTO que define o contrato da resposta.
 */
export const ValidateResponse = (dto: any) => SetMetadata(VALIDATE_RESPONSE_KEY, dto);
