'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraCaptureProps {
  onCapture(file: File): void;
  onCancel(): void;
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const streamRef = useRef<MediaStream | null>(null);

  const [loading, setLoading] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);
  const startCamera = useCallback(async () => {
    try {
      setLoading(true);
      setCameraError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError(
        'Unable to access your camera. Please allow camera permission or upload a photo instead.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startCamera();

    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const capture = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    console.log('video size', video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');

    if (!context) return;

    context.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        console.log('blob created:', blob);

        if (!blob) {
          console.log('NO IMAGE CREATED');
          return;
        }

        const file = new File([blob], `selfie-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });

        console.log('SELFIE FILE:', file);

        stopCamera();

        onCapture(file);
      },
      'image/jpeg',
      0.95,
    );
  };

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-xl border bg-black">
        {cameraError ? (
          <div className="flex h-72 flex-col items-center justify-center gap-3 text-center px-6">
            <CameraOff className="h-10 w-10 text-muted-foreground" />

            <p className="text-sm text-muted-foreground">{cameraError}</p>
          </div>
        ) : (
          <>
            {loading && (
              <div className="flex h-72 items-center justify-center">
                <p className="text-sm text-muted-foreground">Starting camera...</p>
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`h-72 w-full object-cover scale-x-[-1] ${loading ? 'hidden' : 'block'}`}
            />
          </>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => {
            stopCamera();
            onCancel();
          }}
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>

        <Button
          type="button"
          className="flex-1"
          disabled={loading || !!cameraError}
          onClick={capture}
        >
          <Check className="mr-2 h-4 w-4" />
          Capture
        </Button>
      </div>
    </div>
  );
}
