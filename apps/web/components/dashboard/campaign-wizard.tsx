'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ArrowLeft,
  Layers,
  Instagram,
  MessageSquare,
  CheckCircle,
  X,
  HelpCircle,
  RefreshCw,
  Loader2,
  Mic,
  Sparkles,
} from 'lucide-react';
import { Button, Input, Label, toast } from '@autodm/ui';
import { apiRequest, ApiError } from '@/lib/api-client';
import { CustomSelect } from '../ui/custom-select';

interface CampaignWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editCampaignId?: string | null;
}

interface LivePost {
  id: string;
  caption: string;
  mediaUrl: string;
  permalink: string;
  timestamp: string;
  likes: number;
  comments: number;
}

interface ConnectedAccount {
  id: string;
  instagramId: string;
  username: string;
  displayName: string | null;
  profilePicture: string | null;
  isConnected: boolean;
}

export function CampaignWizard({
  isOpen,
  onClose,
  onSuccess,
  editCampaignId,
}: CampaignWizardProps) {
  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);

  // Accounts State
  const [accounts, setAccounts] = React.useState<ConnectedAccount[]>([]);

  // Form State
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [type, setType] = React.useState<
    | 'COMMENT_TO_DM'
    | 'KEYWORD_TO_DM'
    | 'WELCOME_DM'
    | 'STORY_REPLY_TO_DM'
    | 'COMMENT_REPLY'
    | 'SHARE_TO_DM'
  >('COMMENT_TO_DM');
  const [accountId, setAccountId] = React.useState('');
  const [keywords, setKeywords] = React.useState('');
  const [matchingRule, setMatchingRule] = React.useState<'EXACT' | 'CONTAINS'>('EXACT');
  const [selectedPostId, setSelectedPostId] = React.useState<string | null>(null);
  const [replyMessage, setReplyMessage] = React.useState('');
  const [commentReplyEnabled, setCommentReplyEnabled] = React.useState(false);
  const [commentReplyText, setCommentReplyText] = React.useState('');
  const [followCheckEnabled, setFollowCheckEnabled] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isListening, setIsListening] = React.useState(false);

  // Voice Create (AI Speech-to-Automation Assistant)
  const handleVoiceCreate = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition is not supported on this browser. Please use Google Chrome.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        toast.info('🎙️ Listening... Speak your campaign trigger and message instructions now!');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        toast.success(`Voice Captured: "${transcript}"`);

        // Natural Language Parsing
        const matchKw =
          transcript.match(/comment[s]?\s+([A-Z0-9_-]+)/i) ||
          transcript.match(/keyword\s+([A-Z0-9_-]+)/i) ||
          transcript.match(/word\s+([A-Z0-9_-]+)/i);

        if (matchKw && matchKw[1]) {
          setKeywords(matchKw[1].toUpperCase());
        } else {
          setKeywords('LINK');
        }

        setName(
          `Voice Campaign (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
        );
        setReplyMessage(transcript);
        toast.success('Voice Create: Auto-filled trigger keyword and message template!');
      };

      recognition.onerror = (e: any) => {
        setIsListening(false);
        toast.error('Voice Assistant: Speech not detected or microphone access denied.');
      };

      recognition.start();
    } catch (e) {
      setIsListening(false);
      toast.error('Failed to initialize Voice Assistant.');
    }
  };

  // Live posts state
  const [posts, setPosts] = React.useState<LivePost[]>([]);
  const [postsStatus, setPostsStatus] = React.useState<'idle' | 'fetching' | 'cached' | 'error'>(
    'idle',
  );
  const pollRef = React.useRef<NodeJS.Timeout | null>(null);

  interface EditingCampaign {
    name: string;
    description?: string | null;
    type: 'COMMENT_TO_DM' | 'KEYWORD_TO_DM' | 'WELCOME_DM' | 'STORY_REPLY_TO_DM' | 'COMMENT_REPLY';
    instagramAccountId: string;
    replyMessage: string;
    commentReplyEnabled: boolean;
    commentReplyText?: string | null;
    followCheckEnabled: boolean;
    keywords?: { keyword: string; matchingRule: 'EXACT' | 'CONTAINS' }[];
    posts?: { mediaId: string }[];
  }

  // Load campaign for editing
  React.useEffect(() => {
    if (isOpen && editCampaignId) {
      setLoading(true);
      apiRequest<EditingCampaign>(`/campaigns/${editCampaignId}`)
        .then((camp) => {
          setName(camp.name);
          setDescription(camp.description || '');
          setType(camp.type);
          setAccountId(camp.instagramAccountId);
          setReplyMessage(camp.replyMessage);
          setCommentReplyEnabled(camp.commentReplyEnabled || false);
          setCommentReplyText(camp.commentReplyText || '');
          setFollowCheckEnabled(camp.followCheckEnabled || false);
          setErrors({});

          if (camp.keywords && camp.keywords.length > 0) {
            setKeywords(camp.keywords.map((k) => k.keyword).join(', '));
            setMatchingRule(camp.keywords[0].matchingRule);
          } else {
            setKeywords('');
          }

          if (camp.posts && camp.posts.length > 0) {
            setSelectedPostId(camp.posts[0].mediaId);
          } else {
            setSelectedPostId(null);
          }
        })
        .catch(() => toast.error('Failed to load campaign details'))
        .finally(() => setLoading(false));
    } else if (isOpen) {
      setName('');
      setDescription('');
      setType('COMMENT_TO_DM');
      setKeywords('');
      setReplyMessage('');
      setCommentReplyEnabled(false);
      setCommentReplyText('');
      setFollowCheckEnabled(false);
      setSelectedPostId(null);
      setErrors({});
      setStep(1);
    }
  }, [isOpen, editCampaignId]);

  // Fetch accounts on open
  React.useEffect(() => {
    if (isOpen) {
      apiRequest<ConnectedAccount[]>('/instagram')
        .then((res) => {
          setAccounts(res || []);
          if (res && res.length > 0) {
            setAccountId(res[0].id);
          }
        })
        .catch(() => setAccounts([]));
    }
  }, [isOpen]);

  const activeAccount = accounts.find((a) => a.id === accountId) || accounts[0];

  const accountOptions = React.useMemo(() => {
    return accounts.map((acc) => ({
      value: acc.id,
      label: `@${acc.username}`,
      description: acc.displayName || undefined,
    }));
  }, [accounts]);

  // Fetch posts when account changes and type is COMMENT_TO_DM or COMMENT_REPLY
  const fetchPosts = React.useCallback(async (accId: string, silent = false) => {
    if (!silent) setPostsStatus('fetching');
    try {
      const data = await apiRequest<{ posts: LivePost[]; status: string }>(
        `/instagram/${accId}/posts`,
      );
      setPosts(data.posts || []);
      setPostsStatus(data.status === 'fetching' ? 'fetching' : 'cached');
      return data.status;
    } catch (error) {
      setPosts((sub) => sub || []); // preserve previous posts or default to empty
      setPostsStatus('error');
      return 'error';
    }
  }, []);

  React.useEffect(() => {
    if (
      (type !== 'COMMENT_TO_DM' && type !== 'COMMENT_REPLY' && type !== 'SHARE_TO_DM') ||
      !accountId
    )
      return;
    setSelectedPostId(null);
    setPosts([]);
    fetchPosts(accountId);
  }, [type, accountId, fetchPosts]);

  // Poll until posts are populated
  React.useEffect(() => {
    if (postsStatus !== 'fetching') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      const status = await fetchPosts(accountId, true);
      if (status !== 'fetching') clearInterval(pollRef.current!);
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [postsStatus, accountId, fetchPosts]);

  // Cleanup on close
  React.useEffect(() => {
    if (!isOpen) {
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [isOpen]);

  const handleNext = () => {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!name.trim()) {
        newErrors.name = 'Campaign name is required';
      }
      if (!accountId) {
        newErrors.accountId = 'Target Instagram account is required';
      }
    }
    if (step === 2) {
      if (type === 'KEYWORD_TO_DM' && !keywords.trim()) {
        newErrors.keywords = 'Trigger keywords are required';
      }
      if ((type === 'COMMENT_TO_DM' || type === 'COMMENT_REPLY') && !selectedPostId) {
        newErrors.postId = 'Please select a post to monitor';
      }
    }
    if (step === 3) {
      if (type === 'COMMENT_REPLY') {
        if (!commentReplyText.trim()) {
          newErrors.commentReplyText = 'Automated comment reply text is required';
        }
      } else {
        if (!replyMessage.trim()) {
          newErrors.replyMessage = 'Message text template is required';
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error(Object.values(newErrors)[0]);
      return;
    }

    setErrors({});
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleLaunch = async () => {
    setLoading(true);

    try {
      interface CampaignPayload {
        name: string;
        description: string;
        type: string;
        instagramAccountId: string;
        replyMessage: string;
        commentReplyEnabled: boolean;
        commentReplyText: string | null;
        followCheckEnabled: boolean;
        keywords?: { keyword: string; matchingRule: string }[];
        posts?: { mediaId: string; mediaUrl: string; permalink: string }[];
      }

      const payload: CampaignPayload = {
        name,
        description,
        type,
        instagramAccountId: accountId,
        replyMessage: type === 'COMMENT_REPLY' ? 'Public Reply Only' : replyMessage,
        commentReplyEnabled: type === 'COMMENT_REPLY' ? true : commentReplyEnabled,
        commentReplyText:
          type === 'COMMENT_REPLY'
            ? commentReplyText
            : commentReplyEnabled
              ? commentReplyText
              : null,
        followCheckEnabled,
      };

      if (
        (type === 'KEYWORD_TO_DM' ||
          type === 'COMMENT_TO_DM' ||
          type === 'COMMENT_REPLY' ||
          type === 'SHARE_TO_DM') &&
        keywords.trim()
      ) {
        payload.keywords = keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
          .map((k) => ({
            keyword: k,
            matchingRule,
          }));
      }

      if (
        (type === 'COMMENT_TO_DM' || type === 'COMMENT_REPLY' || type === 'SHARE_TO_DM') &&
        selectedPostId
      ) {
        const post = posts.find((p) => p.id === selectedPostId);
        payload.posts = [
          {
            mediaId: selectedPostId,
            mediaUrl: post?.mediaUrl || '',
            permalink: post?.permalink || '',
          },
        ];
      }

      if (editCampaignId) {
        await apiRequest(`/campaigns/${editCampaignId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Campaign updated successfully!', {
          description: `Changes for '${name}' are now active.`,
        });
      } else {
        await apiRequest('/campaigns', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Campaign launched successfully!', {
          description: `Automations for '${name}' are now active.`,
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to launch campaign', error);
      const errMsg = error instanceof ApiError ? error.message : 'Please check your inputs.';
      toast.error(`Failed to launch campaign: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
          />

          {/* Dialog Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className="w-full max-w-4xl glass-card border-gradient rounded-2xl shadow-glass z-10 flex flex-col md:flex-row overflow-hidden h-[90vh] md:h-[85vh] max-h-[90vh] md:max-h-[85vh]"
          >
            {/* Left Sidebar Steps Indicator */}
            <div className="md:w-60 bg-white/5 border-r border-white/5 p-6 flex flex-col justify-between flex-shrink-0">
              <div className="space-y-6">
                <div className="flex items-center space-x-2">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-primary to-accent-cyan flex items-center justify-center text-white">
                    <Layers className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Builder
                  </span>
                </div>

                <div className="space-y-4">
                  {[
                    { s: 1, label: 'Campaign Specs' },
                    { s: 2, label: 'Trigger Settings' },
                    { s: 3, label: 'DM Content' },
                    { s: 4, label: 'Flow & Launch' },
                  ].map((stepItem) => (
                    <div key={stepItem.s} className="flex items-center space-x-3 text-xs">
                      <div
                        className={`h-6 w-6 rounded-full flex items-center justify-center font-bold transition-all ${
                          step === stepItem.s
                            ? 'bg-primary text-primary-foreground shadow-[0_0_10px_rgba(0,187,136,0.3)]'
                            : step > stepItem.s
                              ? 'bg-primary/20 text-primary border border-primary/20'
                              : 'bg-white/5 text-gray-500 border border-white/5'
                        }`}
                      >
                        {stepItem.s}
                      </div>
                      <span
                        className={`font-semibold ${step >= stepItem.s ? 'text-white' : 'text-gray-500'}`}
                      >
                        {stepItem.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hidden md:block text-[10px] text-gray-500 leading-normal">
                Step-by-step assistant for configuring Instagram DM responses.
              </div>
            </div>

            {/* Right Main Content Pane */}
            <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden bg-background/40">
              {/* Header Close button & Step Indicator */}
              <div className="flex items-center justify-between px-6 md:px-8 pt-5 pb-3 border-b border-white/5 flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">
                    Step {step} of 4
                  </span>
                  <span className="text-xs text-gray-500">•</span>
                  <span className="text-xs font-medium text-gray-300">
                    {step === 1 && 'Campaign Specs'}
                    {step === 2 && 'Trigger Settings'}
                    {step === 3 && 'DM & Comment Content'}
                    {step === 4 && 'Flow & Launch'}
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable Body Content */}
              <div className="flex-1 overflow-y-auto min-h-0 px-6 md:px-8 py-5">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  {/* Inputs block */}
                  <div className="flex-1 space-y-4 w-full">
                    {/* Step 1: Specs */}
                    {step === 1 && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-base font-extrabold text-white">
                              Campaign Details
                            </h3>
                            <p className="text-xs text-gray-400">
                              Configure name guidelines and automation triggers.
                            </p>
                          </div>
                          <Button
                            type="button"
                            onClick={handleVoiceCreate}
                            variant="outline"
                            size="sm"
                            className={`text-xs font-bold gap-1.5 border-primary/40 ${
                              isListening
                                ? 'bg-red-500/20 text-red-400 animate-pulse border-red-500'
                                : 'bg-primary/10 text-primary hover:bg-primary/20'
                            }`}
                          >
                            <Mic className="w-3.5 h-3.5" />
                            <span>{isListening ? 'Listening...' : 'Voice Create'}</span>
                          </Button>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="camp-name">Campaign Name</Label>
                          <Input
                            id="camp-name"
                            placeholder="e.g. Ebook Funnel 'GROW'"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={
                              errors.name ? 'border-red-500/50 focus-visible:ring-red-500' : ''
                            }
                          />
                          {errors.name && (
                            <p className="text-[10px] text-red-400 mt-1">{errors.name}</p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="camp-desc">Description (Optional)</Label>
                          <Input
                            id="camp-desc"
                            placeholder="Automated direct replies for summer ebook promo"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Automation Type</Label>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              {
                                id: 'COMMENT_TO_DM',
                                title: 'Comment to DM',
                                desc: 'Comment triggers a direct DM & public reply',
                              },
                              {
                                id: 'KEYWORD_TO_DM',
                                title: 'DM Auto Reply',
                                desc: 'Auto-reply to trigger keywords in DMs',
                              },
                              {
                                id: 'WELCOME_DM',
                                title: 'Welcome DM',
                                desc: 'Reply to new direct message threads',
                              },
                              {
                                id: 'STORY_REPLY_TO_DM',
                                title: 'Story Auto-Reply',
                                desc: 'Reply to story replies/mentions in DMs',
                              },
                              {
                                id: 'SHARE_TO_DM',
                                title: 'Share to DM (Reel & Post)',
                                desc: 'Send Reel or Post in my DM ➔ auto-reply with link',
                              },
                              {
                                id: 'COMMENT_REPLY',
                                title: 'Comment Auto-Reply',
                                desc: 'Public reply to post comments only (No DM)',
                              },
                            ].map((t) => (
                              <button
                                key={t.id}
                                onClick={() =>
                                  setType(
                                    t.id as
                                      | 'COMMENT_TO_DM'
                                      | 'KEYWORD_TO_DM'
                                      | 'WELCOME_DM'
                                      | 'STORY_REPLY_TO_DM'
                                      | 'COMMENT_REPLY'
                                      | 'SHARE_TO_DM',
                                  )
                                }
                                type="button"
                                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                                  type === t.id
                                    ? 'bg-primary/10 border-primary text-white shadow-glass'
                                    : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/10 hover:text-white'
                                }`}
                              >
                                <span className="text-xs font-bold">{t.title}</span>
                                <span className="text-[9px] text-gray-500 mt-1">{t.desc}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 2: Trigger Rules */}
                    {step === 2 && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-4"
                      >
                        <div>
                          <h3 className="text-base font-extrabold text-white">Trigger Actions</h3>
                          <p className="text-xs text-gray-400">
                            Map connected account and select target triggers.
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="acc-select">Instagram Creator Account</Label>
                          <CustomSelect
                            id="acc-select"
                            options={accountOptions}
                            value={accountId}
                            onChange={(val) => setAccountId(val)}
                            placeholder="Select linked channel..."
                            error={errors.accountId}
                          />
                          {errors.accountId && (
                            <p className="text-[10px] text-red-400 mt-1">{errors.accountId}</p>
                          )}
                        </div>

                        {/* Keyword to DM trigger inputs */}
                        {(type === 'KEYWORD_TO_DM' ||
                          type === 'COMMENT_TO_DM' ||
                          type === 'COMMENT_REPLY' ||
                          type === 'STORY_REPLY_TO_DM' ||
                          type === 'SHARE_TO_DM') && (
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <Label htmlFor="keywords-in">
                                Trigger Keywords (comma separated){' '}
                                {(type === 'COMMENT_TO_DM' ||
                                  type === 'COMMENT_REPLY' ||
                                  type === 'STORY_REPLY_TO_DM' ||
                                  type === 'SHARE_TO_DM') &&
                                  '(Optional)'}
                              </Label>
                              <Input
                                id="keywords-in"
                                placeholder={
                                  type === 'SHARE_TO_DM'
                                    ? 'e.g. link, secret (leave empty to trigger immediately on share)'
                                    : type === 'COMMENT_TO_DM' ||
                                        type === 'COMMENT_REPLY' ||
                                        type === 'STORY_REPLY_TO_DM'
                                      ? 'e.g. discount, link (leave empty for any reply)'
                                      : 'e.g. GROW, START, EBOOK'
                                }
                                value={keywords}
                                onChange={(e) => setKeywords(e.target.value)}
                                className={
                                  errors.keywords
                                    ? 'border-red-500/50 focus-visible:ring-red-500'
                                    : ''
                                }
                              />
                              {errors.keywords && (
                                <p className="text-[10px] text-red-400 mt-1">{errors.keywords}</p>
                              )}
                              <span className="text-[10px] text-gray-500">
                                Trigger phrase is case-insensitive.
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor="match-rule">Matching Strategy</Label>
                              <CustomSelect
                                id="match-rule"
                                options={[
                                  {
                                    value: 'EXACT',
                                    label: 'Exact Match',
                                    description:
                                      'Triggers only when the text matches the keyword exactly',
                                  },
                                  {
                                    value: 'CONTAINS',
                                    label: 'Contains Phrase',
                                    description:
                                      'Triggers when the comment/message contains the keyword',
                                  },
                                ]}
                                value={matchingRule}
                                onChange={(val) => setMatchingRule(val as 'EXACT' | 'CONTAINS')}
                              />
                            </div>
                          </div>
                        )}

                        {/* Comment & Share triggers */}
                        {(type === 'COMMENT_TO_DM' ||
                          type === 'COMMENT_REPLY' ||
                          type === 'SHARE_TO_DM') && (
                          <div className="space-y-2">
                            {errors.postId && (
                              <p className="text-xs text-red-400 font-bold">{errors.postId}</p>
                            )}
                            <div className="flex items-center justify-between">
                              <Label>
                                {type === 'SHARE_TO_DM'
                                  ? 'Target Reel or Post (Optional)'
                                  : 'Select Target Post'}
                              </Label>
                              {postsStatus === 'fetching' && (
                                <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                  <Loader2 className="h-3 w-3 animate-spin" /> Fetching live posts…
                                </span>
                              )}
                              {postsStatus === 'cached' && posts && posts.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => fetchPosts(accountId)}
                                  className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition-colors"
                                >
                                  <RefreshCw className="h-3 w-3" /> Refresh
                                </button>
                              )}
                            </div>

                            {type === 'SHARE_TO_DM' && (
                              <button
                                type="button"
                                onClick={() => setSelectedPostId(null)}
                                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all mb-2 cursor-pointer ${
                                  selectedPostId === null
                                    ? 'bg-primary/10 border-primary text-white font-bold'
                                    : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/10 hover:text-white'
                                }`}
                              >
                                <div className="flex items-center space-x-2">
                                  <Sparkles className="h-4 w-4 text-primary" />
                                  <span className="text-xs">Any Reel or Post Shared to DMs</span>
                                </div>
                                <span className="text-[9px] text-primary font-semibold">
                                  Universal Auto-Reply
                                </span>
                              </button>
                            )}

                            {postsStatus === 'fetching' && (!posts || posts.length === 0) ? (
                              <div className="grid grid-cols-2 gap-3">
                                {[1, 2, 3, 4].map((n) => (
                                  <div
                                    key={n}
                                    className="h-20 rounded-xl bg-white/5 border border-white/5 animate-pulse"
                                  />
                                ))}
                              </div>
                            ) : posts && posts.length > 0 ? (
                              <div className="grid grid-cols-2 gap-3">
                                {posts.map((post) => (
                                  <button
                                    key={post.id}
                                    onClick={() => setSelectedPostId(post.id)}
                                    type="button"
                                    className={`p-3 rounded-xl border text-left flex items-start space-x-2.5 transition-all ${
                                      selectedPostId === post.id
                                        ? 'bg-primary/10 border-primary text-white'
                                        : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/10 hover:text-white'
                                    }`}
                                  >
                                    <div className="h-8 w-8 rounded-lg bg-white/5 flex-shrink-0 overflow-hidden">
                                      {post.mediaUrl ? (
                                        <img
                                          src={post.mediaUrl}
                                          alt=""
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <Instagram className="h-4 w-4 m-2 text-gray-500" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[10px] text-gray-400 line-clamp-2 leading-tight">
                                        {post.caption || 'No caption'}
                                      </p>
                                      <span className="text-[8px] text-gray-500 block mt-1">
                                        ❤️ {post.likes} · 💬 {post.comments}
                                      </span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="p-4 rounded-xl border border-dashed border-white/10 bg-white/5 text-center text-xs text-gray-400 space-y-2">
                                <Instagram className="h-6 w-6 text-gray-500 mx-auto" />
                                <p>No posts found. Make sure your account is connected.</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Welcome DM triggers */}
                        {type === 'WELCOME_DM' && (
                          <div className="p-4 rounded-xl border border-dashed border-white/10 bg-white/5 text-center text-xs text-gray-400 space-y-2">
                            <HelpCircle className="h-6 w-6 text-gray-500 mx-auto" />
                            <p>
                              Welcome DM triggers execute on every new thread opened with @
                              {activeAccount?.username || 'your account'}. No keywords or post
                              selections required.
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Step 3: Response Message Editor */}
                    {step === 3 && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-4"
                      >
                        <div>
                          <h3 className="text-base font-extrabold text-white">
                            DM Content Composer
                          </h3>
                          <p className="text-xs text-gray-400">
                            Compose your auto-reply text template.
                          </p>
                        </div>

                        {type !== 'COMMENT_REPLY' && (
                          <div className="space-y-1.5">
                            <Label htmlFor="reply-composer">Message Text</Label>
                            <textarea
                              id="reply-composer"
                              rows={4}
                              value={replyMessage}
                              onChange={(e) => setReplyMessage(e.target.value)}
                              placeholder="Hey! Thanks for leaving a comment. Here is the link to access your free guide: https://example.com/free-guide"
                              className={`w-full p-3 rounded-lg bg-white/5 border text-white text-xs focus:outline-none placeholder-gray-600 resize-none font-sans ${
                                errors.replyMessage
                                  ? 'border-red-500/50 focus:ring-1 focus:ring-red-500'
                                  : 'border-white/10 focus:ring-1 focus:ring-primary'
                              }`}
                            />
                            {errors.replyMessage && (
                              <p className="text-[10px] text-red-400 mt-1">{errors.replyMessage}</p>
                            )}
                            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-[10px] text-primary space-y-1">
                              <div className="font-bold flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Anti-Spam Copy Variations
                                (Auto-Rotation)
                              </div>
                              <p className="text-gray-300 leading-normal">
                                Use pipe separators{' '}
                                <code className="bg-black/30 px-1 py-0.5 rounded text-white font-mono">
                                  |
                                </code>{' '}
                                to add multiple copy variations (e.g.,{' '}
                                <span className="italic">
                                  Hey {'{name}'}! Here is your link: https://dmpilot.org | Hi{' '}
                                  {'{name}'}, tap here to get access: https://dmpilot.org
                                </span>
                                ). AutoDM rotates copy automatically to keep account reputation 100%
                                safe.
                              </p>
                            </div>
                          </div>
                        )}

                        {type === 'COMMENT_REPLY' ? (
                          <div className="space-y-3 pt-3">
                            <div className="flex flex-col">
                              <Label className="font-bold text-white">
                                Automated Comment Reply
                              </Label>
                              <span className="text-[10px] text-gray-500">
                                The text that will be publicly posted as a reply to the comment
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              <Input
                                id="comment-reply-text"
                                placeholder="Thanks for commenting! Check your DM 😊"
                                value={commentReplyText}
                                onChange={(e) => setCommentReplyText(e.target.value)}
                                className={`text-xs h-9 ${errors.commentReplyText ? 'border-red-500/50 focus-visible:ring-red-500' : ''}`}
                              />
                              {errors.commentReplyText && (
                                <p className="text-[10px] text-red-400 mt-1">
                                  {errors.commentReplyText}
                                </p>
                              )}
                              <span className="text-[9px] text-gray-600">
                                Tip: Use <strong>{'{username}'}</strong> or{' '}
                                <strong>{'{name}'}</strong> to personalize it!
                              </span>
                            </div>
                          </div>
                        ) : (
                          (type === 'COMMENT_TO_DM' || type === 'KEYWORD_TO_DM') && (
                            <div className="space-y-3 pt-3 border-t border-white/5">
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                  <Label className="font-bold text-white">
                                    Public Comment Reply (Optional)
                                  </Label>
                                  <span className="text-[10px] text-gray-500">
                                    Reply publicly to commenter on successful DM delivery
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setCommentReplyEnabled(!commentReplyEnabled)}
                                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    commentReplyEnabled ? 'bg-primary' : 'bg-white/10'
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                      commentReplyEnabled ? 'translate-x-4' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                              </div>

                              {commentReplyEnabled && (
                                <div className="space-y-1.5 animate-fadeIn">
                                  <Label htmlFor="comment-reply-text">Public Comment Text</Label>
                                  <Input
                                    id="comment-reply-text"
                                    placeholder="Sent! Check your DMs 😊"
                                    value={commentReplyText}
                                    onChange={(e) => setCommentReplyText(e.target.value)}
                                    className="text-xs h-9"
                                  />
                                  <span className="text-[9px] text-gray-500">
                                    Tip: Use <strong>{'{username}'}</strong> or{' '}
                                    <strong>{'{name}'}</strong> to personalize it!
                                  </span>
                                </div>
                              )}

                              {/* Follow Check Toggle Switch */}
                              <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                                <div className="flex flex-col">
                                  <Label className="font-bold text-white">Follow Check Gate</Label>
                                  <span className="text-[10px] text-gray-500 max-w-[280px]">
                                    Require users to follow your account. Non-followers get a DM
                                    with a follow check button before delivering the campaign reply.
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setFollowCheckEnabled(!followCheckEnabled)}
                                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    followCheckEnabled ? 'bg-primary' : 'bg-white/10'
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                      followCheckEnabled ? 'translate-x-4' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>
                          )
                        )}
                      </motion.div>
                    )}

                    {/* Step 4: Flow Review */}
                    {step === 4 && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-5"
                      >
                        <div>
                          <h3 className="text-base font-extrabold text-white">Flow Verification</h3>
                          <p className="text-xs text-gray-400">
                            Review your campaign automations before enabling.
                          </p>
                        </div>

                        {/* Flow Diagram */}
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center space-y-3 relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary to-accent-cyan" />

                          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                            Automation Loop
                          </div>

                          <div className="flex items-center space-x-2.5 text-xs text-white">
                            <div className="px-2.5 py-1 rounded bg-primary/10 border border-primary/20 font-bold flex items-center space-x-1">
                              <Instagram className="h-3.5 w-3.5 text-primary" />
                              <span>
                                {type === 'COMMENT_TO_DM'
                                  ? 'Comment'
                                  : type === 'KEYWORD_TO_DM'
                                    ? 'Keyword'
                                    : type === 'STORY_REPLY_TO_DM'
                                      ? 'Story Reply'
                                      : type === 'SHARE_TO_DM'
                                        ? 'Reel/Post Share'
                                        : 'New Thread'}
                              </span>
                            </div>

                            <ArrowRight className="h-4 w-4 text-gray-500" />

                            <div className="px-2.5 py-1 rounded bg-accent-cyan/10 border border-accent-cyan/20 font-bold flex items-center space-x-1">
                              <MessageSquare className="h-3.5 w-3.5 text-accent-cyan" />
                              <span>Auto DM</span>
                            </div>
                          </div>

                          <p className="text-[10px] text-gray-400 text-center max-w-xs leading-normal pt-2 border-t border-white/5 w-full">
                            Target Account:{' '}
                            <strong className="text-white">@{activeAccount?.username}</strong>
                            {type === 'KEYWORD_TO_DM' && (
                              <span>
                                <br />
                                Keywords: <strong className="text-white">{keywords}</strong>
                              </span>
                            )}
                            {type === 'STORY_REPLY_TO_DM' && (
                              <span>
                                <br />
                                Trigger:{' '}
                                <strong className="text-white">
                                  {keywords.trim() ? `Keywords: ${keywords}` : 'All Story Replies'}
                                </strong>
                              </span>
                            )}
                            {type === 'SHARE_TO_DM' && (
                              <span>
                                <br />
                                Trigger:{' '}
                                <strong className="text-white">
                                  {selectedPostId
                                    ? 'Specific Reel or Post'
                                    : 'Any Reel or Post shared to DMs'}
                                </strong>
                                {keywords.trim() && (
                                  <span>
                                    {' '}
                                    (Keyword: <strong className="text-white">{keywords}</strong>)
                                  </span>
                                )}
                              </span>
                            )}
                            {type === 'COMMENT_TO_DM' && (
                              <span>
                                <br />
                                Post media monitored:{' '}
                                <strong className="text-white">{selectedPostId}</strong>
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-primary flex items-start space-x-2 text-[10px] leading-normal">
                          <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <p>
                            Launching this campaign will immediately listen to live Meta webhooks.
                            You can toggle active status at any time from the automations panel.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Right phone preview (Visible in Step 3 and 4) */}
                  {(step === 3 || step === 4) && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="hidden lg:block w-56 bg-background border border-white/10 rounded-3xl p-3 flex-shrink-0 shadow-2xl relative overflow-hidden"
                    >
                      {/* Simulated Camera notch */}
                      <div className="h-3 w-16 bg-white/10 rounded-full mx-auto mb-2" />

                      {/* Simulated IG header */}
                      <div className="flex items-center space-x-1.5 border-b border-white/5 pb-2 mb-2">
                        <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-pink-500 to-yellow-500 flex items-center justify-center text-white font-bold text-[8px] overflow-hidden flex-shrink-0">
                          {activeAccount?.profilePicture ? (
                            <img
                              src={activeAccount.profilePicture}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            activeAccount?.username?.[0]?.toUpperCase() || 'A'
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[8px] font-bold text-white truncate">
                            @{activeAccount?.username}
                          </span>
                          <span className="text-[6px] text-gray-500">Instagram Direct</span>
                        </div>
                      </div>

                      {/* Chat Bubble container */}
                      <div className="h-40 flex flex-col justify-end space-y-2 overflow-y-auto pr-1">
                        {type === 'KEYWORD_TO_DM' && (
                          <div className="self-end bg-white/10 px-2.5 py-1.5 rounded-2xl rounded-tr-sm max-w-[85%] text-[8px] text-white">
                            {keywords.split(',')[0] || 'START'}
                          </div>
                        )}

                        {type === 'SHARE_TO_DM' && (
                          <div className="self-end bg-white/10 p-2 rounded-2xl rounded-tr-sm max-w-[85%] text-[8px] text-white flex items-center space-x-1.5 border border-white/10">
                            <div className="h-6 w-6 rounded bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                              <Instagram className="h-3.5 w-3.5 text-white" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold block truncate text-[8px]">
                                {selectedPostId ? 'Shared Reel / Post' : 'Shared Reel / Post'}
                              </span>
                              <span className="text-[6px] text-gray-400 block">
                                Sent in Direct Message
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="self-start bg-primary text-primary-foreground px-2.5 py-1.5 rounded-2xl rounded-tl-sm max-w-[85%] text-[8px] leading-normal break-words whitespace-pre-line">
                          {replyMessage || 'Type message content to preview...'}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Navigation Actions Footer - Sticky Pinned to Modal Bottom */}
              <div className="border-t border-white/10 bg-background/95 backdrop-blur-md px-6 md:px-8 py-3.5 flex justify-between items-center flex-shrink-0 z-20">
                {step > 1 ? (
                  <Button
                    variant="secondary"
                    onClick={handleBack}
                    className="text-xs h-9 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                    <span>Back</span>
                  </Button>
                ) : (
                  <div />
                )}

                {step < 4 ? (
                  <Button
                    onClick={handleNext}
                    className="text-xs h-9 bg-gradient-to-r from-primary to-accent-cyan hover:opacity-90 transition-all text-primary-foreground border-0 shadow-[0_0_12px_rgba(0,187,136,0.2)] cursor-pointer font-bold"
                  >
                    <span>Continue</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleLaunch}
                    disabled={loading}
                    className="text-xs h-9 bg-gradient-to-r from-primary to-accent-cyan hover:opacity-90 transition-all text-primary-foreground border-0 shadow-[0_0_12px_rgba(0,187,136,0.2)] cursor-pointer font-bold"
                  >
                    {loading
                      ? 'Launching Campaign...'
                      : editCampaignId
                        ? 'Save Changes'
                        : 'Launch Campaign'}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
