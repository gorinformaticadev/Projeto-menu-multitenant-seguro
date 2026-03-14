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

  it('ignora chaves fora da whitelist', () => {
    expect(registry.has('database.url')).toBe(false);
    expect(registry.get('database.url')).toBeUndefined();
  });
});
