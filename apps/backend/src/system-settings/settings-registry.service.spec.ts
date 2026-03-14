import {
  SETTINGS_REGISTRY_DEFINITIONS,
  SettingsRegistry,
} from './settings-registry.service';

describe('SettingsRegistry', () => {
  const registry = new SettingsRegistry();

  it('registra apenas a whitelist inicial aprovada', () => {
    const keys = registry.getAll().map((definition) => definition.key).sort();

    expect(keys).toEqual(Object.keys(SETTINGS_REGISTRY_DEFINITIONS).sort());
  });

  it('fornece metadados validos para cada item', () => {
    for (const definition of registry.getAll()) {
      expect(definition.key).toBeTruthy();
      expect(definition.type).toBe('boolean');
      expect(typeof definition.defaultValue).toBe('boolean');
      expect(definition.label).toBeTruthy();
      expect(definition.description).toBeTruthy();
      expect(Array.isArray(definition.operationalNotes ?? [])).toBe(true);
      expect(definition.category).toBeTruthy();
      expect(typeof definition.restartRequired).toBe('boolean');
      expect(typeof definition.sensitive).toBe('boolean');
      expect(typeof definition.requiresConfirmation).toBe('boolean');
      expect(typeof definition.allowedInPanel).toBe('boolean');
      expect(typeof definition.editableInPanel).toBe('boolean');
      expect(definition.validator?.(definition.defaultValue, {
        key: definition.key,
        source: 'default',
      })).toBe(true);
    }
  });

  it('marca configuracoes sensiveis como nao editaveis nesta etapa', () => {
    expect(registry.isEditableInPanel('security.module_upload.enabled')).toBe(true);
    expect(registry.isEditableInPanel('security.headers.enabled')).toBe(false);
  });

  it('mantem security.rate_limit.enabled visivel e somente leitura, com notas operacionais explicitas', () => {
    const definition = registry.getOrThrow('security.rate_limit.enabled');

    expect(definition.allowedInPanel).toBe(true);
    expect(definition.editableInPanel).toBe(false);
    expect(definition.sensitive).toBe(false);
    expect(definition.operationalNotes).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/15 segundos/i),
        expect.stringMatching(/somente leitura/i),
      ]),
    );
  });

  it('mantem security.headers.enabled visivel, somente leitura e com reinicio explicito', () => {
    const definition = registry.getOrThrow('security.headers.enabled');

    expect(definition.allowedInPanel).toBe(true);
    expect(definition.editableInPanel).toBe(false);
    expect(definition.sensitive).toBe(false);
    expect(definition.restartRequired).toBe(true);
    expect(definition.operationalNotes).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/bootstrap http central/i),
        expect.stringMatching(/apos reiniciar o processo/i),
        expect.stringMatching(/somente leitura/i),
      ]),
    );
  });

  it('mantem security.csrf.enabled visivel, somente leitura e com risco operacional explicito', () => {
    const definition = registry.getOrThrow('security.csrf.enabled');

    expect(definition.allowedInPanel).toBe(true);
    expect(definition.editableInPanel).toBe(false);
    expect(definition.sensitive).toBe(false);
    expect(definition.restartRequired).toBe(false);
    expect(definition.operationalNotes).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/guard global/i),
        expect.stringMatching(/15 segundos/i),
        expect.stringMatching(/403/i),
        expect.stringMatching(/somente leitura/i),
      ]),
    );
  });

  it('mantem security.websocket.enabled visivel, somente leitura e com escopo realtime explicito', () => {
    const definition = registry.getOrThrow('security.websocket.enabled');

    expect(definition.allowedInPanel).toBe(true);
    expect(definition.editableInPanel).toBe(false);
    expect(definition.sensitive).toBe(false);
    expect(definition.restartRequired).toBe(false);
    expect(definition.label).toMatch(/WebSocket/i);
    expect(definition.description).toMatch(/Socket\.IO/i);
    expect(definition.operationalNotes).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Socket\.IO ativos/i),
        expect.stringMatching(/novas conexoes websocket sao rejeitadas/i),
        expect.stringMatching(/nao faz dreno global instantaneo/i),
        expect.stringMatching(/15 segundos/i),
        expect.stringMatching(/push\.enabled continua separado/i),
        expect.stringMatching(/somente leitura/i),
      ]),
    );
  });

  it('mantem security.csp_advanced.enabled visivel, somente leitura e com risco operacional explicito para o frontend', () => {
    const definition = registry.getOrThrow('security.csp_advanced.enabled');

    expect(definition.allowedInPanel).toBe(true);
    expect(definition.editableInPanel).toBe(false);
    expect(definition.sensitive).toBe(false);
    expect(definition.restartRequired).toBe(false);
    expect(definition.label).toMatch(/CSP avancado/i);
    expect(definition.description).toMatch(/middleware global do backend/i);
    expect(definition.operationalNotes).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/CspMiddleware global/i),
        expect.stringMatching(/CSP basica.*security\.headers\.enabled/i),
        expect.stringMatching(/15 segundos/i),
        expect.stringMatching(/paginas e clientes reais podem falhar/i),
        expect.stringMatching(/somente leitura/i),
      ]),
    );
  });

  it('ignora chaves fora da whitelist', () => {
    expect(registry.has('database.url')).toBe(false);
    expect(registry.get('database.url')).toBeUndefined();
  });
});
