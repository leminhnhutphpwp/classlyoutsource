"use client";

import { useState, useEffect, useCallback } from "react";

interface UseMediaOptimizationProps {
  media?: any;
  mediaFiles?: any[];
  onOptimizationComplete?: (data: any) => void;
}

export function useMediaOptimization({ 
  media, 
  mediaFiles, 
  onOptimizationComplete 
}: UseMediaOptimizationProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Check if any media needs polling
  const needsPolling = useCallback(() => {
    const mainMediaProcessing = media?.optimize_status === 'processing';
    const filesProcessing = mediaFiles?.some(file => file.optimize_status === 'processing');
    return mainMediaProcessing || filesProcessing;
  }, [media, mediaFiles]);

  const stopPolling = useCallback(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    setIsProcessing(false);
  }, [pollInterval]);

  const checkOptimizationStatus = useCallback(async () => {
    // Check main media
    if (media?.optimize_status === 'processing') {
      try {
        const response = await fetch(`/api/v1/media-optimization/${media._id}/status`);
        const result = await response.json();
        
        if (result.success && result.data.optimize_status !== 'processing') {
          onOptimizationComplete?.(result.data);
        }
      } catch (error) {
        console.error('Error checking optimization status:', error);
      }
    }

    // Check media files
    if (mediaFiles?.length) {
      for (const file of mediaFiles) {
        if (file.optimize_status === 'processing') {
          try {
            const response = await fetch(`/api/v1/media-optimization/${file._id}/status`);
            const result = await response.json();
            
            if (result.success && result.data.optimize_status !== 'processing') {
              onOptimizationComplete?.(result.data);
            }
          } catch (error) {
            console.error('Error checking file optimization status:', error);
          }
        }
      }
    }

    // Stop polling if no more processing
    if (!needsPolling()) {
      stopPolling();
    }
  }, [media, mediaFiles, needsPolling, onOptimizationComplete, stopPolling]);

  const startPolling = useCallback(() => {
    if (pollInterval) return;

    setIsProcessing(true);
    
    const interval = setInterval(async () => {
      try {
        await checkOptimizationStatus();
      } catch (error) {
        console.error('Polling error:', error);
        stopPolling();
      }
    }, 5000);

    setPollInterval(interval);
  }, [pollInterval, checkOptimizationStatus, stopPolling]);

  // Start/stop polling based on processing status
  useEffect(() => {
    if (needsPolling()) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [needsPolling, startPolling, stopPolling]);

  return {
    isProcessing,
    needsPolling: needsPolling(),
    startPolling,
    stopPolling
  };
}