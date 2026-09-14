import { InMemoryCategoryRepository, slugifyCategory } from '../CategoryRepository';

describe('slugifyCategory', () => {
  it('normaliza a ID único en mayúsculas', () => {
    expect(slugifyCategory('Mascotas')).toBe('MASCOTAS');
    expect(slugifyCategory('Cuidado personal!')).toBe('CUIDADO_PERSONAL');
    expect(slugifyCategory('')).toBe('CUSTOM');
  });
});

describe('InMemoryCategoryRepository', () => {
  it('crea y mantiene sufijo si el id colisiona con distinto nombre', async () => {
    const repo = new InMemoryCategoryRepository();
    const a = await repo.create({ label: 'Mascotas', emoji: '🐶', color: '#f97316' });
    expect(a.id).toBe('MASCOTAS');
    // Mismo slug pero distinto nombre visible: sufijo
    const b = await repo.create({ label: 'Mascotas!', emoji: '🐱', color: '#3b82f6' });
    expect(b.id).toBe('MASCOTAS_1');
    expect(await repo.getCustom()).toHaveLength(2);
    await repo.delete('MASCOTAS');
    expect(await repo.getCustom()).toHaveLength(1);
  });

  it('rechaza duplicados por nombre (mayúsculas/tildes/espacios)', async () => {
    const repo = new InMemoryCategoryRepository();
    await repo.create({ label: 'Mascotas', emoji: '🐶', color: '#f97316' });
    await expect(repo.create({ label: 'mascotas', emoji: '🐱', color: '#3b82f6' })).rejects.toThrow(/existe/);
    await expect(repo.create({ label: ' MÁSCOTAS ', emoji: '🐱', color: '#3b82f6' })).rejects.toThrow(/existe/);
    await expect(repo.create({ label: 'Otros', emoji: '📦', color: '#a1a1aa' })).rejects.toThrow(/existe/);
  });

  it('rechaza nombre corto, color inválido y sin icono', async () => {
    const repo = new InMemoryCategoryRepository();
    await expect(repo.create({ label: 'X', emoji: '🐶', color: '#f97316' })).rejects.toThrow(/al menos 2/);
    await expect(repo.create({ label: 'Mascotas', emoji: '🐶', color: 'rojo' })).rejects.toThrow(/Color/);
    await expect(repo.create({ label: 'Mascotas', emoji: '', color: '#f97316' })).rejects.toThrow(/icono/);
  });
});
