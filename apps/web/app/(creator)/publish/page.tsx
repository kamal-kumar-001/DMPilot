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
} from 'lucide-react';
import { Button, Input, Label, toast } from '@dmpilot/ui';
import { apiRequest } from '@/lib/api-client';

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
    } catch (err: any) {
      toast.error('Failed to load accounts or feed');
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  React.useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) {
      toast.error('Select an Instagram account');
      return;
    }
    if (!mediaUrl.trim()) {
      toast.error('Provide a media URL');
      return;
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
        }),
      });

      toast.success('Published to Instagram!');
      setMediaUrl('');
      setCaption('');
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
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Publish Content</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Compose and publish directly to connected Instagram accounts
        </p>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Composer Form */}
        <div className="lg:col-span-7 bg-white/80 backdrop-blur-xl border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
          <form onSubmit={handlePublish} className="space-y-5">
            {/* Account Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Account</Label>
              {accounts.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  No connected Instagram account found. Connect an account in Settings.
                </div>
              ) : (
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      @{acc.username} {acc.displayName ? `(${acc.displayName})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Media Format Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Format</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMediaType('IMAGE')}
                  className={`flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all border ${
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
                  className={`flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all border ${
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

            {/* Media URL Input */}
            <div className="space-y-1.5">
              <Label htmlFor="mediaUrl" className="text-xs font-semibold text-slate-700">
                Media URL (HTTPS)
              </Label>
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

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={publishing || !selectedAccountId || !mediaUrl.trim()}
              className="w-full flex items-center justify-center space-x-2 text-xs font-bold py-3"
            >
              {publishing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Publishing to Instagram...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Publish to Instagram</span>
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
              {mediaUrl.trim() ? (
                mediaType === 'IMAGE' ? (
                  <img
                    src={mediaUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white space-y-2 p-4 text-center">
                    <Video className="h-8 w-8 text-emerald-400" />
                    <span className="text-xs font-medium">Reel Preview Ready</span>
                  </div>
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
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Published & Scheduled Content
          </h2>
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
                <div className="flex items-start space-x-3.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/60 overflow-hidden shrink-0 flex items-center justify-center">
                    {post.mediaType === 'IMAGE' ? (
                      <img
                        src={post.mediaUrl}
                        alt="Thumbnail"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Video className="h-5 w-5 text-slate-500" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-900 line-clamp-1">
                      {post.caption || 'No caption'}
                    </p>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                      <span>{post.mediaType}</span>
                      <span>•</span>
                      <span>
                        {post.publishedAt
                          ? new Date(post.publishedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Recent'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      post.status === 'PUBLISHED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : post.status === 'FAILED'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                          : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                    }`}
                  >
                    {post.status}
                  </span>

                  {post.permalink && (
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                      title="View on Instagram"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
