import { Injectable } from '@nestjs/common';
import { FichaTecnicaValidationPort } from './ficha-tecnica-validation.port';

@Injectable()
export class PendingFichaTecnicaValidator implements FichaTecnicaValidationPort {
  async hasValidFichaTecnica(_productId: string): Promise<boolean> {
    // Ficha Técnica ainda não implementada (Etapa 10). Retornar `false`
    // aqui é a única opção que não viola BR-001 — nunca inverter isto
    // para `true` como "solução temporária".
    return false;
  }
}
