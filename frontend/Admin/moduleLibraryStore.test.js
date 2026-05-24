import {
  getModuleLibrary,
  getModuleById,
  upsertModule,
  deleteModule,
} from './moduleLibraryStore';

describe('moduleLibraryStore', () => {
  beforeEach(() => {
    getModuleLibrary().forEach((moduleItem) => {
      deleteModule(moduleItem.id);
    });
    upsertModule({
      id: 'general-default',
      title: 'General Module',
      moduleImageUrl: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=80',
      moduleLocalImageUri: '',
      sections: [
        {
          id: 'section-1',
          title: '1.1 Conservation',
          content: '<p>Conservation protects biodiversity and ecosystems in Sarawak parks.</p>',
        },
      ],
    });
  });

  test('getModuleLibrary returns the initial normalized module', () => {
    const library = getModuleLibrary();
    expect(library).toHaveLength(1);
    expect(library[0].id).toBe('general-default');
    expect(library[0].modulePrice).toBeNull();
  });

  test('getModuleById returns the correct module when found', () => {
    const moduleItem = getModuleById('general-default');
    expect(moduleItem).not.toBeNull();
    expect(moduleItem.title).toBe('General Module');
  });

  test('getModuleById returns null when module is not found', () => {
    const moduleItem = getModuleById('unknown-id');
    expect(moduleItem).toBeNull();
  });

  test('upsertModule adds a new module if it does not exist', () => {
    const newModule = {
      id: 'new-id',
      title: 'New Module',
      price: 100,
    };
    const result = upsertModule(newModule);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('new-id');
    expect(result[0].modulePrice).toBe(100);
  });

  test('upsertModule updates an existing module if it exists', () => {
    const updatedModule = {
      id: 'general-default',
      title: 'Updated Title',
      modulePrice: 50,
    };
    const result = upsertModule(updatedModule);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Updated Title');
    expect(result[0].modulePrice).toBe(50);
  });

  test('upsertModule normalizes section subsections correctly', () => {
    const complexModule = {
      id: 'complex-id',
      title: 'Complex Module',
      sections: [
        {
          title: 'Section Title',
          subsections: [
            { title: 'Sub 1', content: 'Content 1' },
            { title: '', content: 'Content 2' },
          ],
        },
      ],
    };
    const result = upsertModule(complexModule);
    const savedSection = result[0].sections[0];
    expect(savedSection.content).toBe('<h4>Sub 1</h4>Content 1<hr />Content 2');
    expect(savedSection.id).toBeDefined();
  });

  test('deleteModule removes the module by id', () => {
    const result = deleteModule('general-default');
    expect(result).toHaveLength(0);
    expect(getModuleById('general-default')).toBeNull();
  });
});