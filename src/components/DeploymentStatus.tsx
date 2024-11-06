import React, { useEffect } from 'react';
import { useDeployment } from '../hooks/useDeployment';
import { LoadingSpinner } from './LoadingSpinner';
import { ExternalLink, AlertCircle } from 'lucide-react';

interface DeploymentStatusProps {
  deployId: string;
  onStatusChange?: (status: { url: string; ready: boolean }) => void;
}

export function DeploymentStatus({ deployId, onStatusChange }: DeploymentStatusProps) {
  const { status, isChecking, error, checkStatus } = useDeployment();

  useEffect(() => {
    const checkDeployment = async () => {
      try {
        const status = await checkStatus(deployId);
        onStatusChange?.(status);

        if (!status.ready) {
          // Check again in 5 seconds if not ready
          setTimeout(() => checkDeployment(), 5000);
        }
      } catch (error) {
        // If there's an error, try again in 10 seconds
        setTimeout(() => checkDeployment(), 10000);
      }
    };

    checkDeployment();
  }, [deployId, checkStatus, onStatusChange]);

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <span>Failed to check deployment status: {error.message}</span>
        </div>
      </div>
    );
  }

  if (isChecking && !status) {
    return (
      <div className="flex items-center gap-3 text-gray-600">
        <LoadingSpinner size="sm" />
        <span>Checking deployment status...</span>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="font-medium text-blue-900">
              {status.ready ? 'Deployment Complete!' : 'Deploying...'}
            </h3>
            <p className="mt-1 text-sm text-blue-700">
              {status.ready ? (
                <a
                  href={status.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  View your site <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                'Your site is being deployed...'
              )}
            </p>
          </div>
          {!status.ready && <LoadingSpinner size="sm" className="text-blue-600" />}
        </div>
      </div>

      {status.claim_url && !status.claimed && (
        <div className="rounded-lg bg-green-50 p-4">
          <h4 className="font-medium text-green-900">Want to manage this site?</h4>
          <p className="mt-1 text-sm text-green-700">
            <a
              href={status.claim_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:underline"
            >
              Click here to claim this site <ExternalLink className="h-4 w-4" />
            </a>
          </p>
        </div>
      )}
    </div>
  );
}