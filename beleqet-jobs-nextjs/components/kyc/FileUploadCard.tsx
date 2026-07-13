'use client';

import Image from 'next/image';
import { RefObject } from 'react';

interface FileUploadCardProps {
  title: string;
  description: string;

  previewUrl: string | null;

  inputRef: RefObject<HTMLInputElement>;

  accept?: string;

  buttonLabel?: string;

  onFileSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function FileUploadCard({
  title,
  description,
  previewUrl,
  inputRef,
  accept = 'image/png,image/jpeg,image/webp',
  buttonLabel = 'Upload Image',
  onFileSelected,
}: FileUploadCardProps) {
  return (
    <>
      <input ref={inputRef} type="file" hidden accept={accept} onChange={onFileSelected} />

      {previewUrl ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <div className="relative h-72 w-full">
            <Image src={previewUrl} alt={title} fill className="object-contain p-4" unoptimized />
          </div>

          <div className="border-t bg-white px-5 py-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">{title}</h4>

              <p className="mt-1 text-xs text-gray-500">{description}</p>
            </div>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-100"
            >
              Replace
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="group flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-12 transition hover:border-brandGreen hover:bg-brandGreen/5"
        >
          <svg
            className="mb-4 h-12 w-12 text-gray-400 group-hover:text-brandGreen"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>

          <h3 className="text-sm font-semibold text-gray-900">{buttonLabel}</h3>

          <p className="mt-2 max-w-sm text-center text-xs text-gray-500">{description}</p>

          <span className="mt-4 rounded-md bg-brandGreen px-4 py-2 text-sm font-medium text-white transition group-hover:scale-105">
            Choose File
          </span>
        </button>
      )}
    </>
  );
}
