export interface PingResult {
  url: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
  timestamp: number;
}

export interface PingService {
  name: string;
  url: string;
}

export type PingResults = Record<string, PingResult[]>;

export type CategoryType = 
  | 'Global Services'
  | 'Search Engine Services'
  | 'RSS Services'
  | 'Blog Directory Services'
  | 'Asian Services'
  | 'European Services'
  | 'Blog Platform Services';

export interface ProgressInfo {
  total: number;
  completed: number;
  currentUrl: string;
  currentService: string;
  errors: number;
  successes: number;
}