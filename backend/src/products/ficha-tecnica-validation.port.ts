/**
 * Porta de verificação de BR-001 ("Produto não poderá ser ativado sem
 * ficha técnica válida"). Desacopla ProductsService do módulo de Ficha
 * Técnica, que ainda não existe (Etapa 10).
 *
 * A implementação vinculada hoje (PendingFichaTecnicaValidator) SEMPRE
 * nega a ativação — não é um stub que finge validar, é uma negação
 * deliberada e segura: sem Ficha Técnica real, não há como verificar a
 * regra, então nenhum produto pode ser ativado até que a Etapa 10 troque
 * esta implementação por uma que consulte o módulo de Ficha Técnica de
 * verdade.
 */
export const FICHA_TECNICA_VALIDATION_PORT = Symbol('FICHA_TECNICA_VALIDATION_PORT');

export interface FichaTecnicaValidationPort {
  hasValidFichaTecnica(productId: string): Promise<boolean>;
}
