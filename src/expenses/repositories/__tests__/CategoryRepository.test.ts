import { InMemoryCategoryRepository, slugifyCategory } from '../CategoryRepository';

describe('slugifyCategory', () => {
  it('normaliza a ID único en mayúsculas', () => {
    expect(slugifyCategory('Mascotas')).toBe('MASCOTAS');
    expect(slugifyCategory('Cuidado personal!')).toBe('CUIDADO_PERSONAL');
    expect(slugifyCategory('')).toBe('CUSTOM');
  });
});

describe('InMemoryCategoryRepository', () => {
  it('crea con validación y sufijo si el id existe', async () => {
    const repo = new InMemoryCategoryRepository();
    const a = await repo.create({ label: 'Mascotas', emoji: '🐶', color: '#f97316' });
    expect(a.id).toBe('MASCOTAS');
    const b = await repo.create({ label: 'Mascotas', emoji: '🐱', color: '#3b82f6' });
    expect(b.id).toBe('MASCOTAS_1');
    expect(await repo.getCustom()).toHaveLength(2);
    await repo.delete('MASCOTAS');
    expect(await repo.getCustom()).toHaveLength(1);
  });

  it('rechaza nombre corto, color inválido y sin icono', async () => {
    const repo = new InMemoryCategoryRepository();
    await expect(repo.create({ label: 'X', emoji: '🐶', color: '#f97316' })).rejects.toThrow(/al menos 2/);
    await expect(repo.create({ label: 'Mascotas', emoji: '🐶', color: 'rojo' })).rejects.toThrow(/Color/);
    await expect(repo.create({ label: 'Mascotas', emoji: '', color: '#f97316' })).rejects.toThrow(/icono/);
  });
});
