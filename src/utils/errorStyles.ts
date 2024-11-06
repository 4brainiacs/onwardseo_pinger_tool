import { ErrorSeverity } from '../types/errors';

export const errorSeverityStyles: Record<ErrorSeverity, {
  container: string;
  icon: string;
  title: string;
  message: string;
  button: string;
}> = {
  [ErrorSeverity.LOW]: {
    container: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-500',
    title: 'text-blue-800',
    message: 'text-blue-700',
    button: 'text-blue-500 hover:bg-blue-100'
  },
  [ErrorSeverity.MEDIUM]: {
    container: 'bg-yellow-50 border-yellow-200',
    icon: 'text-yellow-500',
    title: 'text-yellow-800',
    message: 'text-yellow-700',
    button: 'text-yellow-500 hover:bg-yellow-100'
  },
  [ErrorSeverity.HIGH]: {
    container: 'bg-red-50 border-red-200',
    icon: 'text-red-500',
    title: 'text-red-800',
    message: 'text-red-700',
    button: 'text-red-500 hover:bg-red-100'
  },
  [ErrorSeverity.CRITICAL]: {
    container: 'bg-red-100 border-red-300',
    icon: 'text-red-600',
    title: 'text-red-900',
    message: 'text-red-800',
    button: 'text-red-600 hover:bg-red-200'
  }
};