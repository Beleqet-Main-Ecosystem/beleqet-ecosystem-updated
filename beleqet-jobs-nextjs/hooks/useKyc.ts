'use client';

import { useRef, useState } from 'react';

import { getKycUploadUrls, uploadToStorage, submitKycVerification } from '@/lib/kyc/api';

import { IdDocumentType, KycFileState, KycStep } from '@/lib/kyc/types';

export function useKyc() {
  const [currentStep, setCurrentStep] = useState<KycStep>(1);

  const [documentType, setDocumentType] = useState<IdDocumentType>('NATIONAL_ID');

  const [idDocument, setIdDocument] = useState<KycFileState>({
    file: null,
    previewUrl: null,
  });

  const [faceScan, setFaceScan] = useState<KycFileState>({
    file: null,
    previewUrl: null,
  });

  const [error, setError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isCameraActive, setIsCameraActive] = useState(false);

  const idInputRef = useRef<HTMLInputElement>(null);

  const faceInputRef = useRef<HTMLInputElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);

  /**
   * Handle image selection
   */
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>, type: 'id' | 'face') {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    setError(null);

    if (type === 'id') {
      setIdDocument({
        file,
        previewUrl,
      });
    } else {
      setFaceScan({
        file,
        previewUrl,
      });
    }
  }

  /**
   * Start webcam
   */
  async function startCamera() {
    try {
      setError(null);

      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: {
            ideal: 640,
          },
          height: {
            ideal: 480,
          },
        },
      });

      setStream(media);

      if (videoRef.current) {
        videoRef.current.srcObject = media;
      }

      setIsCameraActive(true);
    } catch {
      setError('Camera permission denied. Please upload manually.');
    }
  }

  /**
   * Stop webcam
   */
  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    setStream(null);

    setIsCameraActive(false);
  }

  /**
   * Capture selfie from camera
   */
  function captureSelfie() {
    if (!videoRef.current) return;

    const video = videoRef.current;

    const canvas = document.createElement('canvas');

    canvas.width = video.videoWidth || 640;

    canvas.height = video.videoHeight || 480;

    const context = canvas.getContext('2d');

    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const file = new File([blob], 'selfie.jpg', {
          type: 'image/jpeg',
        });

        setFaceScan({
          file,

          previewUrl: URL.createObjectURL(file),
        });

        stopCamera();
      },
      'image/jpeg',
      0.95,
    );
  }

  /**
   * Submit complete KYC flow
   */
  async function submitVerification() {
    try {
      if (!idDocument.file || !faceScan.file) {
        throw new Error('Both ID document and selfie are required.');
      }

      setIsSubmitting(true);

      setError(null);

      const tokens = await getKycUploadUrls(idDocument.file.type, faceScan.file.type);

      await Promise.all([
        uploadToStorage(tokens.documentUploadUrl, idDocument.file),

        uploadToStorage(tokens.faceScanUploadUrl, faceScan.file),
      ]);

      await submitKycVerification({
        documentType,

        documentStorageKey: tokens.documentStorageKey,

        faceScanStorageKey: tokens.faceScanStorageKey,

        documentMimeType: idDocument.file.type,

        faceScanMimeType: faceScan.file.type,
      });

      setCurrentStep(4);
    } catch (error: any) {
      setError(error.message ?? 'KYC submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function goNext() {
    setCurrentStep((previous) => Math.min(previous + 1, 4) as KycStep);
  }

  function goBack() {
    setCurrentStep((previous) => Math.max(previous - 1, 1) as KycStep);
  }

  return {
    currentStep,
    setCurrentStep,

    documentType,
    setDocumentType,

    idDocument,
    setIdDocument,

    faceScan,
    setFaceScan,

    idInputRef,
    faceInputRef,

    error,

    isSubmitting,

    videoRef,

    isCameraActive,

    handleFileChange,

    startCamera,

    stopCamera,

    captureSelfie,

    submitVerification,

    goNext,

    goBack,
  };
}
