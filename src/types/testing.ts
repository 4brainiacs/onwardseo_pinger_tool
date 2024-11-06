export interface DeviceTest {
  name: string;
  width: number;
  height: number;
}

export interface TestScenario {
  name: string;
  steps: string[];
  results?: {
    [deviceName: string]: {
      passed: boolean;
      notes?: string;
    };
  };
}