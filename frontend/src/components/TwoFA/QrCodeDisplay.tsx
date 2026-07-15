import { useEffect, useState } from 'react';

interface QrCodeDisplayProps {
  provisioningUri: string;
  secret: string;
}

export function QrCodeDisplay({ provisioningUri, secret }: QrCodeDisplayProps) {
  const [qrSvg, setQrSvg] = useState<string>('');

  useEffect(() => {
    import('qrcode').then((QRCode) => {
      QRCode.toString(provisioningUri, {
        type: 'svg',
        width: 200,
        margin: 2,
        color: { dark: '#1a1a2e', light: '#ffffff' },
      }).then(setQrSvg).catch(console.error);
    });
  }, [provisioningUri]);

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-xl font-semibold text-gray-900">Set up Two-Factor Authentication</h2>
      <p className="text-sm text-gray-600 text-center max-w-sm">
        Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.),
        then enter the 6-digit code below.
      </p>
      <div
        className="border-2 border-gray-200 rounded-lg p-4 bg-white"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <div className="mt-2 text-center">
        <p className="text-xs text-gray-500 mb-1">Or enter this key manually:</p>
        <code className="text-sm font-mono bg-gray-100 px-3 py-1 rounded select-all">
          {secret}
        </code>
      </div>
    </div>
  );
}
