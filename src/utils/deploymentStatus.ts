import { getDeploymentStatus } from '../api/deployment';
import { logger } from './logger';

export async function checkDeploymentStatus(deployId: string): Promise<{
  url: string;
  ready: boolean;
  claimed?: boolean;
  claim_url?: string;
}> {
  try {
    const status = await getDeploymentStatus({ id: deployId });
    
    if (!status) {
      throw new Error('Failed to get deployment status');
    }

    return {
      url: status.url,
      ready: status.ready,
      claimed: status.claimed,
      claim_url: status.claim_url
    };
  } catch (error) {
    logger.error('Failed to check deployment status', {
      deployId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}