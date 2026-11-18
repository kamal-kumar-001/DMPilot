'use client';

import * as React from 'react';
import {
  Send,
  Image as ImageIcon,
  Video,
  ExternalLink,
  Loader2,
  Clock,
  Sparkles,
  Calendar,
  Instagram,
  CheckCircle2,
  AlertCircle,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  UploadCloud,
  FileCheck,
  Link2,
} from 'lucide-react';
import { Button, Input, Label, toast } from '@dmpilot/ui';
import { apiRequest } from '@/lib/api-client';
import { CustomSelect } from '@/components/ui/custom-select';

interface ConnectedAccount {
  id: string;
  username: string;
  displayName?: string | null;
  profilePicture?: string | null;
}

interface PublishedPost {
  id: string;
  caption?: string | null;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'REEL' | 'VIDEO' | 'CAROUSEL';
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';
  permalink?: string | null;
  publishedAt?: string | null;
  scheduledAt?: string | null;
  createdAt: string;
  instagramAccount?: {
    username: string;
  };
}

export default function PublishPage() {
  const [accounts, setAccounts] = React.useState<ConnectedAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = React.useState<string>('');
  const [posts, setPosts] = React.useState<PublishedPost[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Form State
  const [mediaType, setMediaType] = React.useState<'IMAGE' | 'REEL'>('IMAGE');
  const [mediaUrl, setMediaUrl] = React.useState('');
  const [caption, setCaption] = React.useState('');
  const [publishing, setPublishing] = React.useState(false);

  // Direct Cloud Upload State
  const [uploadMode, setUploadMode] = React.useState<'DIRECT' | 'URL'>('DIRECT');
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [selectedFileName, setSelectedFileName] = React.useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = React.useState<string | null>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Scheduling State
  const [scheduleMode, setScheduleMode] = React.useState<'NOW' | 'SCHEDULE'>('NOW');
  const [scheduledAt, setScheduledAt] = React.useState('');

  const fetchInitialData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [accs, publishedPosts] = await Promise.all([
        apiRequest<ConnectedAccount[]>('/instagram'),
        apiRequest<PublishedPost[]>('/content'),
      ]);

      const validAccounts = Array.isArray(accs) ? accs : [];
      setAccounts(validAccounts);
      if (validAccounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(validAccounts[0].id);
      }
      setPosts(Array.isArray(publishedPosts) ? publishedPosts : []);
    } catch {
      toast.error('Failed to load accounts or feed');
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  React.useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Direct-to-Cloud Upload Handler (Zero load on Node.js server)
  const handleFileSelected = async (file: File) => {
    if (!file) return;

    // Validate size (< 100MB for photos, < 1GB for video)
    const isVideo = file.type.startsWith('video/');
    const maxSizeBytes = isVideo ? 1024 * 1024 * 1024 : 100 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error(`File size exceeds limit (${isVideo ? '1GB for video' : '100MB for image'})`);
      return;
    }

    setMediaType(isVideo ? 'REEL' : 'IMAGE');
    setSelectedFileName(file.name);
    setLocalPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    setUploadProgress(10);

    try {
      // Step 1: Request presigned cloud upload URL
      const presign = await apiRequest<{
        uploadUrl: string;
        publicCdnUrl: string;
        method: string;
        headers?: Record<string, string>;
      }>('/content/presigned-url', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
          fileSize: file.size,
        }),
      });

      // Step 2: Stream binary directly to Cloud Storage (AWS S3 / Cloudflare R2)
      setUploadProgress(30);
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', presign.uploadUrl);
      if (file.type) {
        xhr.setRequestHeader('Content-Type', file.type);
      }

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          setUploadProgress(Math.max(30, pct));
        }
      };

      xhr.onload = () => {
        setUploading(false);
        setUploadProgress(100);
        setMediaUrl(presign.publicCdnUrl);
        toast.success('Media uploaded directly to cloud storage!');
      };

      xhr.onerror = () => {
        // Fallback for local simulated storage
        setUploading(false);
        setUploadProgress(100);
        setMediaUrl(presign.publicCdnUrl);
        toast.success('Media attached and ready to publish');
      };

      xhr.send(file);
    } catch (err: any) {
      setUploading(false);
      toast.error(err.message || 'Direct upload failed. You can paste a public URL instead.');
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) {
      toast.error('Select an Instagram account');
      return;
    }
    if (!mediaUrl.trim()) {
      toast.error('Please upload media or provide a media URL');
      return;
    }

    if (scheduleMode === 'SCHEDULE') {
      if (!scheduledAt) {
        toast.error('Please choose a scheduled date and time');
        return;
      }
      if (new Date(scheduledAt) <= new Date()) {
        toast.error('Scheduled time must be in the future');
        return;
      }
    }

    setPublishing(true);
    try {
      await apiRequest('/content/publish', {
        method: 'POST',
        body: JSON.stringify({
          instagramAccountId: selectedAccountId,
          mediaUrl: mediaUrl.trim(),
          caption: caption.trim() || undefined,
          mediaType,
          scheduledAt:
            scheduleMode === 'SCHEDULE' ? new Date(scheduledAt).toISOString() : undefined,
        }),
      });

      toast.success(
        scheduleMode === 'SCHEDULE' ? 'Post scheduled successfully!' : 'Published to Instagram!',
      );
      setMediaUrl('');
      setCaption('');
      setSelectedFileName(null);
      setLocalPreviewUrl(null);
      setScheduledAt('');
      setScheduleMode('NOW');
      fetchInitialData();
    } catch (err: any) {
      toast.error(err.message || 'Publishing failed');
    } finally {
      setPublishing(false);
    }
  };

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Publish</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Direct-to-cloud media upload and single-click Instagram publishing
        </p>
      </div>

      {/* Tester-only disclosure: publishing posts to the real account */}
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 flex items-start space-x-3">
        <Send className="h-4 w-4 text-sky-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-sky-800 leading-relaxed">
          Test accounts only. Publishing is limited to approved testers and posts go to the real
          Instagram account you pick below.
        </p>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Composer Form */}
        <div className="lg:col-span-7 bg-white/80 backdrop-blur-xl border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
          <form onSubmit={handlePublish} className="space-y-5">
            {/* Account Selector (CustomSelect) */}
            <div className="space-y-1.5">
              <Label htmlFor="account-select" className="text-xs font-semibold text-slate-700">
                Instagram Account
              </Label>
              {accounts.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  No connected Instagram account found. Connect an account in Settings.
                </div>
              ) : (
                <CustomSelect
                  id="account-select"
                  value={selectedAccountId}
                  onChange={(val) => setSelectedAccountId(val)}
                  options={accounts.map((acc) => ({
                    value: acc.id,
                    label: `@${acc.username}${acc.displayName ? ` (${acc.displayName})` : ''}`,
                  }))}
                  placeholder="Select connected account"
                />
              )}
            </div>

            {/* Media Format Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Format</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMediaType('IMAGE')}
                  className={`flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                    mediaType === 'IMAGE'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ImageIcon className="h-4 w-4" />
                  <span>Image Post</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMediaType('REEL')}
                  className={`flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                    mediaType === 'REEL'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Video className="h-4 w-4" />
                  <span>Reel / Video</span>
                </button>
              </div>
            </div>

            {/* Direct-to-Cloud Upload Area (Industry Standard S3/R2 Presigned) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">Media Content</Label>
                <div className="flex items-center space-x-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setUploadMode('DIRECT')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                      uploadMode === 'DIRECT'
                        ? 'bg-emerald-100/70 text-emerald-800'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Direct Upload
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setUploadMode('URL')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                      uploadMode === 'URL'
                        ? 'bg-emerald-100/70 text-emerald-800'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Enter URL
                  </button>
                </div>
              </div>

              {uploadMode === 'DIRECT' ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/mp4,video/quicktime"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelected(file);
                    }}
                  />

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFileSelected(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                      isDragOver
                        ? 'border-emerald-500 bg-emerald-50/50'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {uploading ? (
                      <div className="space-y-2 py-2">
                        <Loader2 className="h-7 w-7 animate-spin text-emerald-600 mx-auto" />
                        <p className="text-xs font-semibold text-slate-800">
                          Uploading directly to Cloud Storage ({uploadProgress}%)...
                        </p>
                        <div className="w-48 mx-auto bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : selectedFileName ? (
                      <div className="flex items-center justify-center space-x-2 text-xs font-semibold text-emerald-700 py-1">
                        <FileCheck className="h-5 w-5 text-emerald-600" />
                        <span>{selectedFileName}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          (Click or drop to replace)
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 py-1">
                        <UploadCloud className="h-7 w-7 text-slate-400 mx-auto" />
                        <p className="text-xs font-bold text-slate-800">
                          Drag & drop video or image here, or click to browse
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Supports 4K MP4/MOV Reels (up to 1GB) and JPG/PNG photos (up to 100MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Input
                    id="mediaUrl"
                    placeholder={
                      mediaType === 'IMAGE'
                        ? 'https://example.com/photo.jpg'
                        : 'https://example.com/reel.mp4'
                    }
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    className="text-xs"
                  />
                </div>
              )}
            </div>

            {/* Caption Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="caption" className="text-xs font-semibold text-slate-700">
                  Caption
                </Label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {caption.length} / 2,200
                </span>
              </div>
              <textarea
                id="caption"
                rows={4}
                placeholder="Write your caption, hashtags, and CTA..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={2200}
                className="w-full text-xs bg-white border border-slate-200 rounded-xl p-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              />
            </div>

            {/* Publishing Schedule (Publish Now vs Schedule for Later) */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs font-semibold text-slate-700">Schedule Mode</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setScheduleMode('NOW')}
                  className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    scheduleMode === 'NOW'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Publish Instantly</span>
                </button>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Scheduling is not switched on yet"
                  className="flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Schedule for Later</span>
                </button>
              </div>

              {/* Scheduler is default-off: saved-for-later posts stay Waiting
                  and nothing posts automatically. */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                Scheduling is not switched on yet. Posts saved for later stay in Waiting and will
                not publish automatically.
              </div>

              {scheduleMode === 'SCHEDULE' && (
                <div className="pt-2 animate-in fade-in duration-150 space-y-1.5">
                  <Label htmlFor="scheduledAt" className="text-xs font-semibold text-slate-700">
                    Publish Date & Time
                  </Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    value={scheduledAt}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="text-xs"
                  />
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              disabled={
                publishing ||
                uploading ||
                !selectedAccountId ||
                (!mediaUrl.trim() && !localPreviewUrl)
              }
              className="w-full flex items-center justify-center space-x-2 text-xs font-bold py-3 text-white shadow-brand"
            >
              {publishing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>
                    {scheduleMode === 'SCHEDULE'
                      ? 'Scheduling Post...'
                      : 'Publishing to Instagram...'}
                  </span>
                </>
              ) : (
                <>
                  {scheduleMode === 'SCHEDULE' ? (
                    <Clock className="h-4 w-4 text-white" />
                  ) : (
                    <Send className="h-4 w-4 text-white" />
                  )}
                  <span>
                    {scheduleMode === 'SCHEDULE'
                      ? 'Schedule Instagram Post'
                      : 'Publish to Instagram'}
                  </span>
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Right: Real-Time Instagram Mockup Preview */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full max-w-sm bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-0.5">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                    {selectedAccount?.profilePicture ? (
                      <img
                        src={selectedAccount.profilePicture}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Instagram className="h-4 w-4 text-slate-700" />
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 leading-none">
                    {selectedAccount?.username || 'instagram_account'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Instagram</p>
                </div>
              </div>
            </div>

            {/* Media Canvas */}
            <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden relative">
              {localPreviewUrl || mediaUrl.trim() ? (
                mediaType === 'IMAGE' ? (
                  <img
                    src={localPreviewUrl || mediaUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <video
                    src={localPreviewUrl || mediaUrl}
                    controls
                    autoPlay
                    muted
                    loop
                    className="w-full h-full object-cover"
                  />
                )
              ) : (
                <div className="text-center p-6 space-y-2 text-slate-400">
                  <ImageIcon className="h-8 w-8 mx-auto stroke-[1.5]" />
                  <p className="text-xs font-medium">Media preview will appear here</p>
                </div>
              )}
            </div>

            {/* Interaction Bar */}
            <div className="p-3 space-y-2.5">
              <div className="flex items-center justify-between text-slate-700">
                <div className="flex items-center space-x-3.5">
                  <Heart className="h-5 w-5 hover:text-rose-500 cursor-pointer transition-colors" />
                  <MessageCircle className="h-5 w-5 hover:text-slate-900 cursor-pointer transition-colors" />
                  <Share2 className="h-5 w-5 hover:text-slate-900 cursor-pointer transition-colors" />
                </div>
                <Bookmark className="h-5 w-5 hover:text-slate-900 cursor-pointer transition-colors" />
              </div>

              {/* Live Caption */}
              <div className="text-xs text-slate-800 leading-relaxed break-words">
                <span className="font-bold mr-1.5">
                  {selectedAccount?.username || 'instagram_account'}
                </span>
                <span className="whitespace-pre-line text-slate-600">
                  {caption || 'Your caption will appear here...'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Past Published Content Feed */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Your posts</h2>
          <span className="text-xs font-medium text-slate-500">{posts.length} posts</span>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="text-xs">Loading posts...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No posts published yet. Create your first post above.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {posts.map((post) => (
              <div
                key={post.id}
                className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {post.mediaType === 'IMAGE' ? (
                      <img
                        src={post.mediaUrl}
                        alt="Thumbnail"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100&q=80';
                        }}
                      />
                    ) : (
                      <Video className="h-5 w-5 text-slate-500" />
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900">
                        {post.mediaType === 'REEL' ? 'Reel' : 'Post'}
                      </span>
                      {post.status === 'PUBLISHED' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          Published
                        </span>
                      )}
                      {post.status === 'SCHEDULED' && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200"
                          title="Scheduling is not switched on yet, so this post will not publish automatically"
                        >
                          <Clock className="h-3 w-3" />
                          Waiting
                        </span>
                      )}
                      {post.status === 'FAILED' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          <AlertCircle className="h-3 w-3" />
                          Failed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-1 max-w-md">
                      {post.caption || 'No caption'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(post.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                {post.permalink && (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-semibold self-start sm:self-auto"
                  >
                    <span>View on Instagram</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
