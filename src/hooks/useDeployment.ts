import { useState, useCallback } from 'react';
import { checkDeploymentStatus } from '../utils/deploymentStatus';
import { logger } from '../utils/logger';

interface DeploymentStatus {
  url: string;
  ready: boolean;
  claimed?: boolean;
  claim_url?: string;
}

export function useDeployment() {
  const [status, setStatus] = useState<DeploymentStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const checkStatus = useCallback(async (deployId: string) => {
    setIsChecking(true);
    setError(null);
    
    try {
      const deploymentStatus = await checkDeploymentStatus(deployId);
      setStatus(deploymentStatus);
      return deploymentStatus;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to check deployment status');
      setError(error);
      logger.error('Deployment status check failed', {
        deployId,
        error: error.message
      });
      throw error;
    } finally {
      setIsChecking(false);
    }
  }, []);

  return {
    status,
    isChecking,
    error,
    checkStatus
  };
}