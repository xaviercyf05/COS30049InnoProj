import {
  saveModuleProgress,
  fetchModuleProgress,
  calculateProgressPercent,
} from './moduleProgressApi.js';

import { requestProfileApi } from '../Profile/profileApi.js';

jest.mock('../Profile/profileApi.js', () => ({
  requestProfileApi: jest.fn(),
}));

describe('moduleProgress.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });


  // saveModuleProgress Tests
  test('saveModuleProgress saves progress successfully', async () => {
    requestProfileApi.mockResolvedValueOnce({
      success: true,
    });

    const visited = new Set(['s1', 's2']);

    const result = await saveModuleProgress(
      'module1',
      visited,
      45,
      'token123'
    );

    expect(requestProfileApi).toHaveBeenCalledWith(
      '/api/v1/modules/module1/progress',
      'token123',
      {
        method: 'POST',
        body: {
          visitedSectionIds: ['s1', 's2'],
          progressPercent: 45,
        },
      }
    );

    expect(result).toEqual({
      success: true,
    });
  });

  test('saveModuleProgress rounds percentage correctly', async () => {
    requestProfileApi.mockResolvedValueOnce({
      success: true,
    });

    await saveModuleProgress(
      'module1',
      ['s1'],
      45.8,
      'token123'
    );

    expect(requestProfileApi).toHaveBeenCalledWith(
      '/api/v1/modules/module1/progress',
      'token123',
      {
        method: 'POST',
        body: {
          visitedSectionIds: ['s1'],
          progressPercent: 46,
        },
      }
    );
  });

  test('saveModuleProgress limits percentage to 100', async () => {
    requestProfileApi.mockResolvedValueOnce({
      success: true,
    });

    await saveModuleProgress(
      'module1',
      ['s1'],
      150,
      'token123'
    );

    expect(requestProfileApi).toHaveBeenCalledWith(
      '/api/v1/modules/module1/progress',
      'token123',
      {
        method: 'POST',
        body: {
          visitedSectionIds: ['s1'],
          progressPercent: 100,
        },
      }
    );
  });

  test('saveModuleProgress limits percentage to minimum 0', async () => {
    requestProfileApi.mockResolvedValueOnce({
      success: true,
    });

    await saveModuleProgress(
      'module1',
      ['s1'],
      -20,
      'token123'
    );

    expect(requestProfileApi).toHaveBeenCalledWith(
      '/api/v1/modules/module1/progress',
      'token123',
      {
        method: 'POST',
        body: {
          visitedSectionIds: ['s1'],
          progressPercent: 0,
        },
      }
    );
  });

  test('saveModuleProgress throws error when API fails', async () => {
    requestProfileApi.mockRejectedValueOnce(
      new Error('API Error')
    );

    await expect(
      saveModuleProgress(
        'module1',
        ['s1'],
        50,
        'token123'
      )
    ).rejects.toThrow('API Error');
  });

  // fetchModuleProgress Tests
  test('fetchModuleProgress returns progress data', async () => {
    requestProfileApi.mockResolvedValueOnce({
      data: {
        visitedSectionIds: ['s1', 's2'],
        progressPercent: 75,
      },
    });

    const result = await fetchModuleProgress(
      'module1',
      'token123'
    );

    expect(requestProfileApi).toHaveBeenCalledWith(
      '/api/v1/modules/module1/progress',
      'token123',
      {
        method: 'GET',
      }
    );

    expect(result).toEqual({
      visitedSectionIds: ['s1', 's2'],
      progressPercent: 75,
    });
  });

  test('fetchModuleProgress returns default values when data missing', async () => {
    requestProfileApi.mockResolvedValueOnce({
      data: {},
    });

    const result = await fetchModuleProgress(
      'module1',
      'token123'
    );

    expect(result).toEqual({
      visitedSectionIds: [],
      progressPercent: 0,
    });
  });

  test('fetchModuleProgress returns empty progress when API fails', async () => {
    requestProfileApi.mockRejectedValueOnce(
      new Error('Fetch Failed')
    );

    const result = await fetchModuleProgress(
      'module1',
      'token123'
    );

    expect(result).toEqual({
      visitedSectionIds: [],
      progressPercent: 0,
    });
  });

  // calculateProgressPercent Tests
  test('calculateProgressPercent returns 0 when no sections', () => {
    const result = calculateProgressPercent(
      new Set(),
      []
    );

    expect(result).toBe(0);
  });

  test('calculateProgressPercent calculates correct percentage', () => {
    const sections = [
      {
        id: 's1',
        subsections: [
          { id: 'sub1' },
          { id: 'sub2' },
        ],
      },
      {
        id: 's2',
        subsections: [],
      },
    ];

    const visited = new Set([
      's1',
      'sub1',
    ]);

    const result = calculateProgressPercent(
      visited,
      sections
    );

    expect(result).toBe(50);
  });

  test('calculateProgressPercent ignores invalid IDs', () => {
    const sections = [
      {
        id: 's1',
        subsections: [],
      },
    ];

    const visited = new Set([
      'invalid-id',
    ]);

    const result = calculateProgressPercent(
      visited,
      sections
    );

    expect(result).toBe(0);
  });

  test('calculateProgressPercent ignores duplicate IDs', () => {
    const sections = [
      {
        id: 's1',
        subsections: [],
      },
      {
        id: 's2',
        subsections: [],
      },
    ];

    const visited = ['s1', 's1'];

    const result = calculateProgressPercent(
      visited,
      sections
    );

    expect(result).toBe(50);
  });

  test('calculateProgressPercent returns 100 for full completion', () => {
    const sections = [
      {
        id: 's1',
        subsections: [
          { id: 'sub1' },
        ],
      },
    ];

    const visited = new Set([
      's1',
      'sub1',
    ]);

    const result = calculateProgressPercent(
      visited,
      sections
    );

    expect(result).toBe(100);
  });
});