import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AnalyticsDashboard from './AnalyticsDashboard';
import { Alert } from 'react-native';
import {
  fetchAnalyticsDashboardData,
  fetchAdminParkGuideAccounts,
  updateAdminUserStatus,
  workbookSheets,
  createEmptyAnalyticsData
} from './analyticsApi.js';

jest.mock('./analyticsApi.js', () => ({
  fetchAnalyticsDashboardData: jest.fn(),
  fetchAdminParkGuideAccounts: jest.fn(),
  updateAdminUserStatus: jest.fn(),
  workbookSheets: [
    { key: 'overview', title: 'Overview', accent: '#000000' },
    { key: 'modules', title: 'Modules', accent: '#111111' },
    { key: 'progress', title: 'Progress', accent: '#222222' },
    { key: 'parkGuides', title: 'Park Guides', accent: '#333333' }
  ],
  createEmptyAnalyticsData: jest.fn(() => ({
    overview: { title: 'Empty Overview', subtitle: 'Empty Sub', kpis: [] },
    modules: { title: 'Empty Modules', subtitle: 'Empty Sub', kpis: [], chartType: 'pie', pieSlices: [] },
    progress: { title: 'Empty Progress', subtitle: 'Empty Sub', kpis: [], bars: [] },
    parkGuides: { title: 'Empty Park Guides', subtitle: 'Empty Sub' }
  })),
  PIE_COLORS: ['#ff0000', '#00ff00']
}));

describe('AnalyticsDashboard Component Tests', () => {
  const mockDashboardData = {
    overview: {
      title: 'Overview Main Title',
      subtitle: 'Overview Main Subtitle',
      kpis: [
        { label: 'Total Registrations', value: 1250, note: 'All-time active users' },
        { label: 'Pending Approvals', value: 5, note: 'Needs review' }
      ]
    },
    modules: {
      title: 'Modules Sheet Title',
      subtitle: 'Modules Sheet Subtitle',
      chartTitle: 'Module Charts Distribution',
      chartSubtitle: 'Breakdown by enrollment type',
      chartType: 'pie',
      pieSlices: [
        { label: 'General Safety', value: 400 },
        { label: 'On-Site Training Module', value: 150 }
      ],
      kpis: []
    },
    progress: {
      title: 'Progress Tracking Title',
      subtitle: 'Progress Tracking Subtitle',
      chartTitle: 'Completion Progress Chart',
      chartSubtitle: 'Aggregated course progress numbers',
      bars: [
        { label: 'Module A', value: 75 },
        { label: 'On-Site Evaluation', value: 30 }
      ],
      kpis: [
        { label: 'Total Hours Spent', value: 450, note: 'Accumulated time' }
      ]
    },
    parkGuides: {
      title: 'Park Guides Account Overview',
      subtitle: 'Manage profile operational availability'
    }
  };

  const mockParkGuideAccounts = [
    {
      id: 'guide-1',
      userId: 'user-id-1',
      fullName: 'Alice Smith',
      username: 'alicesmith',
      email: 'alice@park.org',
      role: 'Senior Ranger',
      isActive: true,
      joinDate: '2025-01-15T08:00:00.000Z'
    },
    {
      id: 'guide-2',
      userId: 'user-id-2',
      fullName: 'Bob Jones',
      username: 'bobjones',
      email: 'bob@park.org',
      role: 'Junior Guide',
      isActive: false,
      joinDate: '2026-03-22T10:00:00.000Z'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    fetchAnalyticsDashboardData.mockImplementation(() => new Promise((resolve) => resolve(mockDashboardData)));
    fetchAdminParkGuideAccounts.mockImplementation(() => new Promise((resolve) => resolve(mockParkGuideAccounts)));
  });

  it('renders loading indicators and transitions to dashboard views cleanly', async () => {
    const { findByText, queryByText } = render(<AnalyticsDashboard />);
    
    expect(fetchAnalyticsDashboardData).toHaveBeenCalledTimes(1);
    
    const overviewTitle = await findByText('Overview Main Title');
    expect(overviewTitle).toBeTruthy();
    expect(queryByText('Overview Main Subtitle')).toBeTruthy();
    expect(queryByText('Total Registrations')).toBeTruthy();
    expect(queryByText('1,250')).toBeTruthy();
    expect(queryByText('Pending Approvals')).toBeTruthy();
  });

  it('handles data fetching rejection responses by presenting a working retry operation', async () => {
    fetchAnalyticsDashboardData.mockImplementationOnce(() => new Promise((_, reject) => reject(new Error('Network connectivity issue'))));
    
    const { findByText, getByText } = render(<AnalyticsDashboard />);
    
    const errorMessage = await findByText('Network connectivity issue');
    expect(errorMessage).toBeTruthy();
    
    fetchAnalyticsDashboardData.mockImplementationOnce(() => new Promise((resolve) => resolve(mockDashboardData)));
    
    const retryButton = getByText('Retry');
    fireEvent.press(retryButton);
    
    const resolvedTitle = await findByText('Overview Main Title');
    expect(resolvedTitle).toBeTruthy();
  });

  it('switches navigation targets when alternative workbook tabs are requested', async () => {
    const { findByText, getByText, queryByText } = render(<AnalyticsDashboard />);
    
    await findByText('Overview Main Title');
    
    const modulesTabButton = getByText('Modules');
    fireEvent.press(modulesTabButton);
    
    expect(await findByText('Modules Sheet Title')).toBeTruthy();
    expect(queryByText('Module Charts Distribution')).toBeTruthy();
  });

  it('filters progress sheet metrics appropriately by stripping specific hour entries', async () => {
    const { findByText, getByText, queryByText } = render(<AnalyticsDashboard />);
    
    await findByText('Overview Main Title');
    
    const progressTabButton = getByText('Progress');
    fireEvent.press(progressTabButton);
    
    expect(await findByText('Progress Tracking Title')).toBeTruthy();
    expect(queryByText('Total Hours Spent')).toBeNull();
  });

  it('populates and handles modular group sub-tabs under graphical display components', async () => {
    const { findByText, getByText, queryByText } = render(<AnalyticsDashboard />);
    
    await findByText('Overview Main Title');
    
    const modulesTabButton = getByText('Modules');
    fireEvent.press(modulesTabButton);
    
    await findByText('Modules Sheet Title');
    
    const onsiteInnerTab = getByText('On-Site');
    fireEvent.press(onsiteInnerTab);
    
    expect(queryByText('On-Site Training Module')).toBeTruthy();
  });

  it('loads operational account lists securely when selecting the park guide tracking screen', async () => {
    const { findByText, getByText, queryByText } = render(<AnalyticsDashboard />);
    
    await findByText('Overview Main Title');
    
    const parkGuidesTabButton = getByText('Park Guides');
    fireEvent.press(parkGuidesTabButton);
    
    expect(fetchAdminParkGuideAccounts).toHaveBeenCalledTimes(1);
    
    expect(await findByText('Alice Smith')).toBeTruthy();
    expect(queryByText('bob@park.org')).toBeTruthy();
  });

  it('adjusts account visibility listings when typing valid filters into the input search utility', async () => {
    const { findByText, getByText, getByPlaceholderText, queryByText } = render(<AnalyticsDashboard />);
    
    await findByText('Overview Main Title');
    fireEvent.press(getByText('Park Guides'));
    
    await findByText('Alice Smith');
    
    const inputSearchField = getByPlaceholderText('Search by guide name, username, or email');
    fireEvent.changeText(inputSearchField, 'bob');
    
    expect(queryByText('Alice Smith')).toBeNull();
    expect(queryByText('Bob Jones')).toBeTruthy();
  });

  it('filters information rows exactly to matched configuration metrics via filter chips', async () => {
    const { findByText, getByText, queryByText } = render(<AnalyticsDashboard />);
    
    await findByText('Overview Main Title');
    fireEvent.press(getByText('Park Guides'));
    
    await findByText('Alice Smith');
    
    const inactiveFilterChip = getByText('Inactive');
    fireEvent.press(inactiveFilterChip);
    
    expect(queryByText('Alice Smith')).toBeNull();
    expect(queryByText('Bob Jones')).toBeTruthy();
  });

  it('handles external re-fetch activities trigger requests via context control panels', async () => {
    const { findByText, getByText } = render(<AnalyticsDashboard />);
    
    await findByText('Overview Main Title');
    fireEvent.press(getByText('Park Guides'));
    
    await findByText('Alice Smith');
    expect(fetchAdminParkGuideAccounts).toHaveBeenCalledTimes(1);
    
    const refreshTriggerButton = getByText('Refresh');
    fireEvent.press(refreshTriggerButton);
    
    expect(fetchAdminParkGuideAccounts).toHaveBeenCalledTimes(2);
  });

  it('initiates user status mutations through confirmed native interactive alert procedures', async () => {
    const { findByText, getByText, getAllByText } = render(<AnalyticsDashboard />);
    
    await findByText('Overview Main Title');
    fireEvent.press(getByText('Park Guides'));
    
    await findByText('Alice Smith');
    
    const targetActionButtons = getAllByText('Deactivate');
    fireEvent.press(targetActionButtons[0]);
    
    expect(Alert.alert).toHaveBeenCalledWith(
      'Deactivate account',
      'Are you sure you want to deactivate Alice Smith?',
      expect.any(Array)
    );
    
    const executionCallbackOption = Alert.alert.mock.calls[0][2].find(
      (btn) => btn.text === 'Deactivate'
    );
    
    updateAdminUserStatus.mockImplementation(() => new Promise((resolve) => resolve({ success: true })));
    
    await executionCallbackOption.onPress();
    
    expect(updateAdminUserStatus).toHaveBeenCalledWith('user-id-1', 'Inactive');
    expect(fetchAdminParkGuideAccounts).toHaveBeenCalledTimes(2);
  });
});