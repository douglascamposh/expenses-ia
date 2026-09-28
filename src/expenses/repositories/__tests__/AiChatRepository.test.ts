import { InMemoryAiChatRepository } from '../AiChatRepository';

describe('AiChatRepository (paginación)', () => {
  it('lista newest-first y pagina con beforeId', async () => {
    const repo = new InMemoryAiChatRepository();
    for (let i = 1; i <= 12; i++) {
      await repo.add('user', JSON.stringify({ text: `m${i}` }));
    }
    const page1 = await repo.list({ limit: 10 });
    expect(page1).toHaveLength(10);
    expect(JSON.parse(page1[0].content).text).toBe('m12');
    expect(JSON.parse(page1[9].content).text).toBe('m3');
    const page2 = await repo.list({ limit: 10, beforeId: page1[page1.length - 1].id });
    expect(page2.map((m) => JSON.parse(m.content).text)).toEqual(['m2', 'm1']);
    const page3 = await repo.list({ limit: 10, beforeId: page2[page2.length - 1].id });
    expect(page3).toHaveLength(0);
  });

  it('clearAll vacía', async () => {
    const repo = new InMemoryAiChatRepository();
    await repo.add('ai', '{}');
    await repo.clearAll();
    expect(await repo.list({ limit: 10 })).toEqual([]);
  });
});
