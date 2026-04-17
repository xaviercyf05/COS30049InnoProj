function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

const initialLibrary = [
  {
    id: 'general-default',
    title: 'General Module',
    moduleImageUrl:
      'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=80',
    moduleLocalImageUri: '',
    sections: [
      {
        id: 'section-1',
        title: '1.1 Conservation',
        subsections: [
          {
            id: 'sub-1',
            title: '1.1.1 Introduction to Conservation',
            content:
              '<p>Conservation protects biodiversity and ecosystems in Sarawak parks.</p>',
          },
        ],
      },
    ],
  },
];

let moduleLibrary = cloneDeep(initialLibrary);

export function getModuleLibrary() {
  return cloneDeep(moduleLibrary);
}

export function getModuleById(moduleId) {
  const moduleEntry = moduleLibrary.find((moduleItem) => moduleItem.id === moduleId);
  return moduleEntry ? cloneDeep(moduleEntry) : null;
}

export function upsertModule(draftModule) {
  const modulePayload = cloneDeep(draftModule);

  const existingIndex = moduleLibrary.findIndex((moduleItem) => moduleItem.id === modulePayload.id);

  if (existingIndex >= 0) {
    moduleLibrary[existingIndex] = modulePayload;
  } else {
    moduleLibrary = [modulePayload, ...moduleLibrary];
  }

  return cloneDeep(moduleLibrary);
}

export function deleteModule(moduleId) {
  moduleLibrary = moduleLibrary.filter((moduleItem) => moduleItem.id !== moduleId);
  return cloneDeep(moduleLibrary);
}
