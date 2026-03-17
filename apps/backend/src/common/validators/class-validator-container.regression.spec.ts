import { registerDecorator, useContainer, validate } from 'class-validator';

function InlineConstraint() {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'inlineConstraint',
      target: object.constructor,
      propertyName,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && value.length > 0;
        },
      },
    });
  };
}

class InlineConstraintDto {
  @InlineConstraint()
  value!: string;
}

describe('class-validator container bridge regression', () => {
  it('does not throw when inline CustomConstraint is not resolvable in Nest container', async () => {
    useContainer(
      {
        get() {
          throw new Error('provider not found');
        },
      } as any,
      { fallback: true, fallbackOnErrors: true },
    );

    const validDto = new InlineConstraintDto();
    validDto.value = 'ok';

    await expect(validate(validDto)).resolves.toHaveLength(0);

    const invalidDto = new InlineConstraintDto();
    invalidDto.value = '';
    await expect(validate(invalidDto)).resolves.toHaveLength(1);
  });
});
