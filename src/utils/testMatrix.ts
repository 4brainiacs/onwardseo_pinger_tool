import type { DeviceTest } from '../types';

export const TEST_DEVICES: Record<string, DeviceTest[]> = {
  mobile: [
    { name: 'OnePlus 6T', width: 402, height: 858 }
  ]
};

export const TEST_SCENARIOS = [
  {
    name: 'Bulk URL Test',
    steps: [
      'Load application',
      'Add 5 test URLs',
      'Check progress display',
      'Verify results grid',
      'Test scrolling behavior'
    ]
  }
];