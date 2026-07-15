"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation, Locale } from '../../lib/i18n';
import { CurrencyUtil } from '../../lib/currency';
import { 
  ShieldCheck, 
  UploadCloud, 
  FileText, 
  Trash2, 
  Eye, 
  Lock, 
  Languages, 
  UserCheck, 
  Coins, 
  AlertTriangle,
  Loader2,
  Download
} from 'lucide-react';

/**
 * Interface representing a file record fetched from the backend.
 */
interface StoredFile {
  id: string;
  key: string;
  filename: string;
  mimeType: string;
  size: number;
  hasConsentedToProcessing: boolean;
  isDeleted: boolean;
  createdAt: string;
}

/**
 * StorageDashboard component offering a premium cloud file management panel
 * equipped with developer authentication, multi-currency support, GDPR consent checkpoints,
 * i18n switcher, and soft-delete capabilities.
 *
 * @security GDPR Compliance: Restricts file uploads without explicit consent.
 *           Authentication: Uses JWT access tokens stored securely in client state and localStorage.
 */
export default function StorageDashboard(): React.ReactElement {
  const { locale, changeLanguage, t } = useTranslation();
  
  // Auth state
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string>('admin@beleqet.com');
  const [password, setPassword] = useState<string>('SecurePass123!');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [consentChecked, setConsentChecked] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Files list state
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [activeFileUrls, setActiveFileUrls] = useState<Record<string, string>>({});
  const [isGeneratingUrl, setIsGeneratingUrl] = useState<string | null>(null);

  // Currency utility state (Base fee: 50.00 ETB or 1.00 USD)
  const [selectedCurrency, setSelectedCurrency] = useState<'ETB' | 'USD'>('ETB');
  const baseFeeCents = selectedCurrency === 'ETB' ? 5000 : 100;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('beleqet_token');
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  // Fetch files when token changes
  useEffect(() => {
    if (token) {
      fetchUserFiles();
    } else {
      setFiles([]);
    }
  }, [token]);

  /**
   * Performs authentication request to the backend with specified credentials
   * and saves the JWT token upon success.
   *
   * @param e - React Form submit event.
   * @throws Error if network request or authentication fails.
   * @security Session Handling: Stores JWT in client state and localStorage.
   */
  const handleDeveloperLogin = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError(null);

    try {
      const response = await fetch('http://localhost:4000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Authentication failed. Check your developer credentials.');
      }

      const data = (await response.json()) as { accessToken: string };
      setToken(data.accessToken);
      localStorage.setItem('beleqet_token', data.accessToken);
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  /**
   * Clears the user authentication session and locally cached state data.
   */
  const handleLogout = (): void => {
    setToken(null);
    localStorage.removeItem('beleqet_token');
    setFiles([]);
    setActiveFileUrls({});
  };

  /**
   * Retrieves the listing of files uploaded by the active authenticated user from the backend.
   *
   * @throws Error if the HTTP request fails.
   */
  const fetchUserFiles = async (): Promise<void> => {
    if (!token) return;
    setIsLoadingFiles(true);

    try {
      const response = await fetch('http://localhost:4000/api/v1/storage/my-files', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve file list.');
      }

      const list = (await response.json()) as StoredFile[];
      setFiles(list);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  /**
   * Handles file dragover events on dropzone.
   *
   * @param e - Drag event.
   */
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
  };

  /**
   * Handles dropped files in dropzone.
   *
   * @param e - Drag event containing files list.
   */
  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  /**
   * Handles file selection changes via input element.
   *
   * @param e - Form change event.
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  /**
   * Validates file constraints (type and size) before saving file state.
   * Enforces 5MB limit for images and 10MB limit for documents.
   *
   * @param selected - File object to validate.
   */
  const validateAndSetFile = (selected: File): void => {
    setUploadFeedback(null);
    
    const allowedImages = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedDocs = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    const isImage = allowedImages.includes(selected.type);
    const isDoc = allowedDocs.includes(selected.type);

    if (!isImage && !isDoc) {
      setUploadFeedback({ message: t('storage.errorMime'), type: 'error' });
      return;
    }

    const maxSize = isImage ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    if (selected.size > maxSize) {
      setUploadFeedback({
        message: isImage ? t('storage.errorSizeImage') : t('storage.errorSizeDoc'),
        type: 'error',
      });
      return;
    }

    setFile(selected);
  };

  /**
   * Dispatches the file payload and GDPR consent flag to backend upload route.
   *
   * @param e - Form submit event.
   * @throws Error if network or upload processing fails.
   */
  const handleUploadSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!file) return;

    if (!consentChecked) {
      setUploadFeedback({ message: t('storage.gdprWarning'), type: 'error' });
      return;
    }

    setIsUploading(true);
    setUploadFeedback(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('hasConsentedToProcessing', 'true');

    try {
      const response = await fetch('http://localhost:4000/api/v1/storage/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed.');
      }

      setUploadFeedback({ message: t('storage.successUpload'), type: 'success' });
      setFile(null);
      setConsentChecked(false);
      
      // Refresh user files list
      await fetchUserFiles();
    } catch (err) {
      setUploadFeedback({ message: t('storage.failedUpload'), type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Generates or fetches a secure presigned access URL for a specific file key.
   *
   * @param key - The target file S3 key pathway.
   * @throws Error if network fetch fails.
   */
  const handleFetchUrl = async (key: string): Promise<void> => {
    setIsGeneratingUrl(key);

    try {
      const response = await fetch(`http://localhost:4000/api/v1/storage/url/${key}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve secure URL.');
      }

      const data = (await response.json()) as { url: string };
      
      // Cache URL in state
      setActiveFileUrls((prev) => ({ ...prev, [key]: data.url }));
      
      // Open in a new secure window tab
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingUrl(null);
    }
  };

  /**
   * Triggers the GDPR soft-delete action for the specified key.
   *
   * @param key - The target file S3 key pathway to delete.
   * @throws Error if delete processing fails.
   */
  const handleDeleteFile = async (key: string): Promise<void> => {
    if (!window.confirm('Are you sure you want to permanently delete this file and mask its metadata?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:4000/api/v1/storage/${key}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to delete file.');
      }

      // Refresh list to update status and mask name
      await fetchUserFiles();
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * Formats file size bytes to human-readable string values (KB, MB).
   *
   * @param bytes - Numeric byte size count.
   * @returns Formatted size representation string.
   */
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-[#070d0a] text-slate-100 selection:bg-[#22c55e] selection:text-white">
      <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Top Header & Translation Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-[#143022] pb-8 mb-10">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <ShieldCheck className="w-9 h-9 text-[#22c55e] animate-pulse" />
              <span className="bg-gradient-to-r from-white via-slate-200 to-[#22c55e] bg-clip-text text-transparent">
                {t('storage.title')}
              </span>
            </h1>
            <p className="mt-2 text-slate-400 text-sm sm:text-base max-w-2xl leading-relaxed">
              {t('storage.description')}
            </p>
          </div>
          
          <div className="flex items-center gap-3 bg-[#0d1f15] border border-[#143022] rounded-full p-1.5 shadow-lg">
            <Languages className="w-4 h-4 text-[#22c55e] ml-2" />
            <button 
              onClick={() => changeLanguage('en')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                locale === 'en' ? 'bg-[#22c55e] text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              English
            </button>
            <button 
              onClick={() => changeLanguage('am')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                locale === 'am' ? 'bg-[#22c55e] text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              አማርኛ
            </button>
          </div>
        </div>

        {/* 1. Developer Session Authentication Gateway */}
        {!token ? (
          <div className="max-w-md mx-auto bg-[#0c1811]/90 backdrop-blur-md border border-[#1b3d2b] rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-[#22c55e] to-transparent"></div>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="bg-[#122c1d] border border-[#1b3d2b] p-4 rounded-full text-[#22c55e] mb-4">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-wide">{t('storage.devPortal')}</h2>
              <p className="text-xs text-slate-400 mt-2">
                {t('storage.devPortalSub')}
              </p>
            </div>

            <form onSubmit={handleDeveloperLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  {t('storage.emailLabel')}
                </label>
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#050b07] border border-[#1b3d2b] rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-[#22c55e] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  {t('storage.passwordLabel')}
                </label>
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-[#050b07] border border-[#1b3d2b] rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-[#22c55e] transition-colors"
                />
              </div>

              {authError && (
                <div className="bg-red-950/40 border border-red-900 rounded-xl p-3 flex items-start gap-2.5 text-red-400 text-xs">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button 
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-[#22c55e] hover:bg-[#1ca84f] disabled:opacity-60 text-white font-bold text-sm tracking-wider uppercase py-3.5 px-4 rounded-xl transition-all shadow-lg hover:shadow-[#22c55e]/20 flex justify-center items-center gap-2"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('storage.verifying')}
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    {t('storage.authorizeButton')}
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Session Toolbar */}
            <div className="bg-[#0b1710] border border-[#143022] rounded-2xl px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-300">
                <span className="w-2.5 h-2.5 bg-[#22c55e] rounded-full animate-ping"></span>
                <span>{t('storage.activeSession')} <strong>admin@beleqet.com</strong></span>
              </div>
              <button 
                onClick={handleLogout}
                className="text-xs font-semibold uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors border border-red-900/30 hover:border-red-900/60 bg-red-950/20 px-4 py-2 rounded-xl"
              >
                {t('storage.terminateSession')}
              </button>
            </div>

            {/* Main Action Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Column 1: Secure File Upload Zone */}
              <div className="lg:col-span-7 bg-[#0c1811]/90 backdrop-blur-md border border-[#1b3d2b] rounded-3xl p-6 sm:p-8 shadow-xl relative group">
                <h2 className="text-xl font-bold text-white mb-6 tracking-wide flex items-center gap-2.5">
                  <UploadCloud className="w-5 h-5 text-[#22c55e]" />
                  {t('storage.uploadHeader')}
                </h2>

                <form onSubmit={handleUploadSubmit} className="space-y-6">
                  {/* Dropzone container */}
                  <div 
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#1b3d2b] hover:border-[#22c55e] bg-[#050b07] rounded-2xl p-6 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-[#07130b]/60 relative group"
                  >
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    
                    <div className="bg-[#122c1d]/60 border border-[#1b3d2b] group-hover:border-[#22c55e] group-hover:text-[#22c55e] p-4 rounded-full text-slate-400 mb-4 transition-all">
                      <UploadCloud className="w-8 h-8" />
                    </div>

                    {file ? (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white truncate max-w-xs">{file.name}</p>
                        <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-white tracking-wide">{t('storage.dropzoneMain')}</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm">{t('storage.dropzoneSub')}</p>
                      </>
                    )}
                  </div>

                  {/* GDPR Consent Card */}
                  <div className="bg-[#050b07] border border-[#143022] rounded-2xl p-4 flex items-start gap-3">
                    <input 
                      type="checkbox"
                      id="gdpr-consent"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-[#1b3d2b] text-[#22c55e] focus:ring-[#22c55e] bg-[#050b07] cursor-pointer"
                    />
                    <label htmlFor="gdpr-consent" className="text-xs text-slate-400 select-none cursor-pointer leading-normal">
                      {t('storage.gdprConsent')}
                    </label>
                  </div>

                  {uploadFeedback && (
                    <div className={`p-4 rounded-2xl border flex items-start gap-2.5 text-xs ${
                      uploadFeedback.type === 'success' 
                        ? 'bg-green-950/30 border-[#22c55e]/40 text-[#22c55e]' 
                        : 'bg-red-950/30 border-red-900/40 text-red-400'
                    }`}>
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{uploadFeedback.message}</span>
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={isUploading || !file}
                    className="w-full bg-[#22c55e] hover:bg-[#1ca84f] disabled:opacity-50 text-white font-bold text-sm tracking-wider uppercase py-4 rounded-xl transition-all shadow-lg hover:shadow-[#22c55e]/25 flex justify-center items-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('storage.uploading')}
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        {t('storage.uploadButton')}
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Column 2: Premium Multi-currency checkout calculator */}
              <div className="lg:col-span-5 bg-[#0c1811]/90 backdrop-blur-md border border-[#1b3d2b] rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden flex flex-col justify-between group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-[#22c55e]/10 to-transparent pointer-events-none"></div>
                <div>
                  <h2 className="text-xl font-bold text-white mb-4 tracking-wide flex items-center gap-2.5">
                    <Coins className="w-5 h-5 text-[#22c55e]" />
                    {t('storage.calculatorHeader')}
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6">
                    {t('storage.premiumDesc')}
                  </p>

                  <div className="bg-[#050b07] border border-[#143022] rounded-2xl p-5 mb-6 space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">{t('storage.activationFee')}</span>
                      <span className="font-bold text-[#22c55e] text-lg">
                        {CurrencyUtil.format(baseFeeCents, selectedCurrency)}
                      </span>
                    </div>
                    <div className="border-t border-[#143022] pt-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">{t('storage.equivalentUnits')}</span>
                        <span className="font-mono text-slate-200">{baseFeeCents} {t('storage.units')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    {t('storage.currencyToggle')}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setSelectedCurrency('ETB')}
                      className={`py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all border ${
                        selectedCurrency === 'ETB'
                          ? 'bg-[#122c1d] border-[#22c55e] text-[#22c55e] shadow-inner'
                          : 'bg-[#050b07] border-[#143022] text-slate-400 hover:text-white'
                      }`}
                    >
                      ETB (Santim)
                    </button>
                    <button 
                      onClick={() => setSelectedCurrency('USD')}
                      className={`py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all border ${
                        selectedCurrency === 'USD'
                          ? 'bg-[#122c1d] border-[#22c55e] text-[#22c55e] shadow-inner'
                          : 'bg-[#050b07] border-[#143022] text-slate-400 hover:text-white'
                      }`}
                    >
                      USD (Cents)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Secure Stored Files List */}
            <div className="bg-[#0c1811]/90 backdrop-blur-md border border-[#1b3d2b] rounded-3xl p-6 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-6 tracking-wide flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-[#22c55e]" />
                {t('storage.uploadedHeader')}
              </h2>

              {isLoadingFiles ? (
                <div className="py-12 flex flex-col justify-center items-center gap-3 text-slate-400 text-sm">
                  <Loader2 className="w-8 h-8 text-[#22c55e] animate-spin" />
                  Retrieving file indexes...
                </div>
              ) : files.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-[#1b3d2b] rounded-2xl flex flex-col items-center">
                  <FileText className="w-10 h-10 text-slate-600 mb-3" />
                  <p className="text-sm text-slate-400">{t('storage.noFiles')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#143022] text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        <th className="py-4 px-4">{t('storage.filenameHeader')}</th>
                        <th className="py-4 px-4">{t('storage.fileKey')}</th>
                        <th className="py-4 px-4">{t('storage.fileSize')}</th>
                        <th className="py-4 px-4">{t('storage.fileStatus')}</th>
                        <th className="py-4 px-4 text-right">{t('storage.actionsHeader')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#143022]/40 text-sm">
                      {files.map((item) => (
                        <tr key={item.id} className="hover:bg-[#07130b]/30 transition-colors">
                          <td className="py-4 px-4 font-semibold text-white flex items-center gap-2.5">
                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="truncate max-w-xs">{item.filename}</span>
                          </td>
                          <td className="py-4 px-4 font-mono text-xs text-slate-400">{item.key}</td>
                          <td className="py-4 px-4 text-slate-300">{formatBytes(item.size)}</td>
                          <td className="py-4 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              item.isDeleted 
                                ? 'bg-red-950/40 border border-red-900/40 text-red-400'
                                : 'bg-[#122c1d] border border-[#22c55e]/30 text-[#22c55e]'
                            }`}>
                              {item.isDeleted ? t('storage.statusDeleted') : t('storage.statusActive')}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              {!item.isDeleted && (
                                <>
                                  <button 
                                    onClick={() => handleFetchUrl(item.key)}
                                    disabled={isGeneratingUrl === item.key}
                                    className="bg-[#122c1d] hover:bg-[#1a3f29] disabled:opacity-50 text-[#22c55e] border border-[#22c55e]/30 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                                  >
                                    {isGeneratingUrl === item.key ? (
                                      <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        {t('storage.loadingLink')}
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="w-3.5 h-3.5" />
                                        {t('storage.actionLink')}
                                      </>
                                    )}
                                  </button>
                                  
                                  <button 
                                    onClick={() => handleDeleteFile(item.key)}
                                    className="bg-red-950/30 hover:bg-red-900/20 text-red-400 border border-red-900/30 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    {t('storage.actionDelete')}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
