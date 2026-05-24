function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeSection(section, index = 0) {
  const composedFromSubsections = Array.isArray(section?.subsections)
    ? section.subsections
        .map((subSection) => {
          const subTitle = subSection?.title?.trim();
          const subContent = subSection?.content?.trim();

          if (!subTitle && !subContent) {
            return '';
          }

          if (subTitle && subContent) {
            return `<h4>${subTitle}</h4>${subContent}`;
          }

          return subTitle || subContent || '';
        })
        .filter(Boolean)
        .join('<hr />')
    : '';

  return {
    id: section?.id || `section-${Date.now()}-${index}`,
    title: section?.title || '',
    content: section?.content || composedFromSubsections,
  };
}

function normalizeModule(moduleEntry) {
  return {
    ...moduleEntry,
    modulePrice: moduleEntry?.modulePrice ?? moduleEntry?.price ?? null,
    sections: Array.isArray(moduleEntry?.sections)
      ? moduleEntry.sections.map((section, index) => normalizeSection(section, index))
      : [],
  };
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
        content:
          '<p>Conservation protects biodiversity and ecosystems in Sarawak parks.</p>',
      },
    ],
  },
];

let moduleLibrary = cloneDeep(initialLibrary).map((moduleEntry) =>
  normalizeModule(moduleEntry)
);

export function getModuleLibrary() {
  return cloneDeep(moduleLibrary);
}

export function getModuleById(moduleId) {
  const moduleEntry = moduleLibrary.find((moduleItem) => moduleItem.id === moduleId);
  return moduleEntry ? cloneDeep(moduleEntry) : null;
}

export function upsertModule(draftModule) {
  const modulePayload = normalizeModule(cloneDeep(draftModule));

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
