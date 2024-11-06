import { AppError, ErrorSeverity } from '../utils/errorHandler';

interface DeploymentStatus {
  url: string;
  ready: boolean;
  claimed?: boolean;
  claim_url?: string;
}

export async function getDeploymentStatus({ id }: { id: string }): Promise<DeploymentStatus> {
  try {
    const response = await fetch(`/api/deployment/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch deployment status');
    }
    return await response.json();
  } catch (error) {
    throw new AppError(
      'Failed to check deployment status',
      'DEPLOYMENT_STATUS_ERROR',
      {
        severity: ErrorSeverity.HIGH,
        context: { deploymentId: id }
      }
    );
  }
}