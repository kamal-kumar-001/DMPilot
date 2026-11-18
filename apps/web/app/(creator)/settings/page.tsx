'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import {
  User,
  Shield,
  Lock,
  Bell,
  Settings,
  Globe,
  ShieldAlert,
  Loader2,
  Eye,
  EyeOff,
  CreditCard,
  CheckCircle2,
  Archive,
  Key,
} from 'lucide-react';
import { Button, Input, Label, toast } from '@dmpilot/ui';
import { apiRequest } from '@/lib/api-client';
import { clearDraftIfVerified, readCheckoutPending } from '@/lib/checkout-draft';
import { ConnectedAccounts } from '@/components/dashboard/connected-accounts';
import { PrivilegedConnectCard } from '@/components/dashboard/privileged-connect';
import { CustomSelect } from '@/components/ui/custom-select';
import { SettingsArchivedCampaigns } from '@/components/settings/settings-archived-campaigns';
import { SettingsApiKeys } from '@/components/settings/settings-api-keys';
import { SettingsBilling } from '@/components/settings/settings-billing';

type SettingTab =
  'profile' | 'security' | 'channels' | 'billing' | 'preferences' | 'campaigns' | 'apikeys';

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const [activeTab, setActiveTab] = React.useState<SettingTab>('profile');
  React.useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (
      requested &&
      [
        'profile',
        'security',
        'channels',
        'billing',
        'preferences',
        'campaigns',
        'apikeys',
      ].includes(requested)
    )
      setActiveTab(requested as SettingTab);
    else if (readCheckoutPending(session?.user?.id)) setActiveTab('billing');
  }, [session?.user?.id]);

  // Profile Edit State
  const [name, setName] = React.useState('');
  const [updatingProfile, setUpdatingProfile] = React.useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [changingPassword, setChangingPassword] = React.useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  // Preference Settings State
  const [timezone, setTimezone] = React.useState('UTC');
  const [emailNotify, setEmailNotify] = React.useState(true);
  const [savingPrefs, setSavingPrefs] = React.useState(false);

  // Account Deletion State
  const [deleteRequest, setDeleteRequest] = React.useState<any | null>(null);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [deleteReason, setDeleteReason] = React.useState('');
  const [deleteFeedback, setDeleteFeedback] = React.useState('');
  const [confirmDeleteCheck, setConfirmDeleteCheck] = React.useState(false);
  const [submittingDelete, setSubmittingDelete] = React.useState(false);
  const [cancellingDelete, setCancellingDelete] = React.useState(false);

  const fetchDeleteRequest = React.useCallback(async () => {
    try {
      const data = await apiRequest<any>('/auth/delete-request');
      setDeleteRequest(data);
    } catch (e) {
      setDeleteRequest(null);
    }
  }, []);

  React.useEffect(() => {
    if (session?.user?.name) {
      setName(session.user.name);
    }
    fetchDeleteRequest();
  }, [session, fetchDeleteRequest]);

  const handleSubmitDeleteRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteReason) {
      toast.error('Please select a reason for deletion.');
      return;
    }
    if (!confirmDeleteCheck) {
      toast.error('Please check the confirmation box.');
      return;
    }

    setSubmittingDelete(true);
    try {
      const data = await apiRequest<any>('/auth/delete-request', {
        method: 'POST',
        body: JSON.stringify({ reason: deleteReason, feedback: deleteFeedback }),
      });
      setDeleteRequest(data);
      setShowDeleteModal(false);
      toast.success('Account deletion request submitted for administrative approval.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit request');
    } finally {
      setSubmittingDelete(false);
    }
  };

  const handleCancelDeleteRequest = async () => {
    const confirm = window.confirm(
      'Are you sure you want to cancel your account deletion request?',
    );
    if (!confirm) return;

    setCancellingDelete(true);
    try {
      await apiRequest('/auth/delete-request', {
        method: 'DELETE',
      });
      setDeleteRequest(null);
      toast.success('Account deletion request cancelled.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel request');
    } finally {
      setCancellingDelete(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }

    setUpdatingProfile(true);
    try {
      const updatedUser = await apiRequest<{ name: string }>('/auth/me', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });

      // Update NextAuth local session storage cache
      await updateSession({
        user: {
          ...session?.user,
          name: updatedUser.name,
        },
      });

      toast.success('Profile details updated successfully!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }

    setChangingPassword(true);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast.success('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Incorrect current password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrefs(true);
    setTimeout(() => {
      setSavingPrefs(false);
      toast.success('Notification and Regional preferences saved!');
    }, 800);
  };

  const userEmail = session?.user?.email || 'user@dmpilot.org';
  const userRole = session?.user?.role || 'CREATOR';

  return (
    <>
      <div className="space-y-6">
        {/* Header Title */}
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Settings</h1>
          <p className="text-xs text-slate-600">
            Manage account options, channels, and security settings
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Tab Navigation Menu: a horizontal scroll row on phones so the
              content panel is not buried under seven stacked buttons. */}
          <div className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0 -mb-1 md:mb-0">
            {[
              { id: 'profile' as const, label: 'Profile Options', icon: User },
              { id: 'security' as const, label: 'Security & Access', icon: Lock },
              { id: 'channels' as const, label: 'Instagram Channels', icon: Globe },
              { id: 'billing' as const, label: 'Billing & Plan', icon: CreditCard },
              { id: 'apikeys' as const, label: 'Agent & API Keys', icon: Key },
              { id: 'preferences' as const, label: 'Preferences', icon: Bell },
              { id: 'campaigns' as const, label: 'Archived & Trash', icon: Archive },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all border cursor-pointer whitespace-nowrap md:whitespace-normal shrink-0 md:shrink ${
                  activeTab === tab.id
                    ? 'bg-primary/10 border-primary/20 text-primary shadow-sm font-bold'
                    : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content Panel */}
          <div className="md:col-span-3 space-y-6">
            {activeTab === 'billing' && <SettingsBilling />}
            {activeTab === 'campaigns' && <SettingsArchivedCampaigns />}
            {activeTab === 'apikeys' && <SettingsApiKeys />}

            {activeTab === 'profile' && (
              <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
                  <User className="h-5 w-5 text-emerald-600" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Public Profile Settings</h3>
                    <p className="text-[10px] text-slate-500">
                      Update your account name and identity metadata
                    </p>
                  </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
                  <div className="space-y-1.5">
                    <Label htmlFor="prof-name">Full Name</Label>
                    <Input
                      id="prof-name"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="prof-email">Email Address</Label>
                      {session?.user?.isVerified !== false ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Verified ✓
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Unverified
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              const toastId = toast.loading('Sending verification email...');
                              try {
                                if (!userEmail) {
                                  throw new Error('Email address is missing');
                                }
                                await apiRequest('/auth/resend-verification', {
                                  method: 'POST',
                                  body: JSON.stringify({ email: userEmail }),
                                });
                                toast.success('Verification link sent! Check your inbox.', {
                                  id: toastId,
                                });
                              } catch (err) {
                                const msg =
                                  err instanceof Error
                                    ? err.message
                                    : 'Failed to send verification link';
                                toast.error(msg, { id: toastId });
                              }
                            }}
                            className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                          >
                            Resend Link
                          </button>
                        </span>
                      )}
                    </div>
                    <Input
                      id="prof-email"
                      value={userEmail}
                      disabled
                      className="bg-slate-100 text-slate-800 font-medium border-slate-200 select-none cursor-not-allowed shadow-2xs"
                    />
                    <span className="text-[9px] text-slate-500 flex items-center space-x-1">
                      <Shield className="h-3 w-3" />
                      <span>Email address cannot be changed. Contact support if needed.</span>
                    </span>
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    className="font-semibold text-xs h-9 w-28 cursor-pointer"
                    disabled={updatingProfile}
                  >
                    {updatingProfile ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Save Profile'
                    )}
                  </Button>
                </form>

                {/* Danger Zone */}
                <div className="pt-6 border-t border-rose-200/80 space-y-4">
                  <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                      <h5 className="text-xs font-bold text-slate-900">
                        Permanently Delete Account
                      </h5>
                      <p className="text-xs text-slate-600 max-w-md">
                        Once submitted, your profile deletion request will be routed to the
                        administrator. If approved, all your channels, campaigns, and data will be
                        permanently wiped.
                      </p>
                    </div>

                    {deleteRequest ? (
                      <div className="flex flex-col sm:items-end gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                          Pending Approval
                        </span>
                        <Button
                          onClick={handleCancelDeleteRequest}
                          disabled={cancellingDelete}
                          variant="secondary"
                          size="sm"
                          className="text-xs h-8 text-rose-700 hover:text-rose-800 border-rose-200 bg-rose-50 hover:bg-rose-100 cursor-pointer font-semibold"
                        >
                          {cancellingDelete ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Cancel Request'
                          )}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="destructive"
                        onClick={() => {
                          setDeleteReason('');
                          setDeleteFeedback('');
                          setConfirmDeleteCheck(false);
                          setShowDeleteModal(true);
                        }}
                        size="sm"
                        className="text-xs h-9 bg-rose-600 hover:bg-rose-700 text-white cursor-pointer font-bold shadow-sm"
                      >
                        Delete Account
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
                  <Lock className="h-5 w-5 text-cyan-600" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Update Password</h3>
                    <p className="text-[10px] text-slate-500">
                      Secure your session with a new credential profile
                    </p>
                  </div>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                  {/* Current Password */}
                  <div className="space-y-1.5 relative">
                    <Label htmlFor="curr-pass">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="curr-pass"
                        type={showCurrentPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-1.5 relative">
                    <Label htmlFor="new-pass">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new-pass"
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div className="space-y-1.5 relative">
                    <Label htmlFor="conf-pass">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="conf-pass"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    className="font-semibold text-xs h-9 w-36 cursor-pointer text-white shadow-brand"
                    disabled={changingPassword}
                  >
                    {changingPassword ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      'Change Password'
                    )}
                  </Button>
                </form>
              </div>
            )}

            {activeTab === 'channels' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-6 rounded-2xl shadow-sm flex justify-between items-center">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900">
                      Instagram Channels Management
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      Link new channels or check access authorizations.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1">
                  <ConnectedAccounts />
                </div>
                <PrivilegedConnectCard />
              </div>
            )}

            {activeTab === 'preferences' && (
              <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
                  <Settings className="h-5 w-5 text-amber-500" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Notification & Regional Preferences
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      Configure dashboard alerts and server timezone variables
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSavePreferences} className="space-y-6 max-w-md">
                  {/* Timezone */}
                  <div className="space-y-1.5">
                    <Label htmlFor="pref-tz">System Timezone</Label>
                    <CustomSelect
                      id="pref-tz"
                      value={timezone}
                      onChange={(val) => setTimezone(val)}
                      options={[
                        { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
                        { value: 'EST', label: 'Eastern Standard Time (EST)' },
                        { value: 'PST', label: 'Pacific Standard Time (PST)' },
                        { value: 'IST', label: 'Indian Standard Time (IST)' },
                      ]}
                    />
                  </div>

                  {/* Toggle Notification */}
                  <div className="flex items-center space-x-3 p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/80">
                    <input
                      id="pref-email"
                      type="checkbox"
                      checked={emailNotify}
                      onChange={(e) => setEmailNotify(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 bg-white text-primary focus:ring-primary cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <Label
                        htmlFor="pref-email"
                        className="font-semibold text-slate-800 cursor-pointer"
                      >
                        Email reports
                      </Label>
                      <span className="text-[9px] text-slate-500">
                        Receive weekly summaries of DM response analytics
                      </span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    className="font-semibold text-xs h-9 w-28 cursor-pointer"
                    disabled={savingPrefs}
                  >
                    {savingPrefs ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Settings'}
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs cursor-pointer"
            onClick={() => setShowDeleteModal(false)}
          />

          {/* Dialog content */}
          <div className="w-full max-w-md bg-white border border-slate-200 p-6 rounded-3xl shadow-2xl z-10 space-y-4 animate-in fade-in duration-200">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Request Account Deletion
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              We are sorry to see you go. Please let us know why you would like to delete your
              creator account. Your request will be reviewed by an administrator.
            </p>

            <form onSubmit={handleSubmitDeleteRequest} className="space-y-4">
              {/* Reason Dropdown */}
              <div className="space-y-1.5">
                <Label htmlFor="del-reason" className="text-slate-800">
                  Reason for leaving
                </Label>
                <CustomSelect
                  id="del-reason"
                  value={deleteReason}
                  onChange={(val) => setDeleteReason(val)}
                  placeholder="Select a reason..."
                  options={[
                    { value: 'Alternative Found', label: 'Found a better alternative' },
                    { value: 'Too Difficult', label: 'Too complex / difficult to set up' },
                    { value: 'No Longer Needed', label: 'No longer need Instagram automation' },
                    { value: 'Privacy / Security', label: 'Privacy or security concerns' },
                    { value: 'Other', label: 'Other reason' },
                  ]}
                />
              </div>

              {/* Feedback text area */}
              <div className="space-y-1.5">
                <Label htmlFor="del-feedback" className="text-slate-800">
                  Additional Comments
                </Label>
                <textarea
                  id="del-feedback"
                  value={deleteFeedback}
                  onChange={(e) => setDeleteFeedback(e.target.value)}
                  placeholder="Share any thoughts or suggestions..."
                  className="w-full h-20 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 resize-none"
                />
              </div>

              {/* Confirmation checkbox */}
              <div className="flex items-start space-x-2.5 p-3.5 bg-rose-50/60 rounded-2xl border border-rose-200/80">
                <input
                  id="del-confirm"
                  type="checkbox"
                  checked={confirmDeleteCheck}
                  onChange={(e) => setConfirmDeleteCheck(e.target.checked)}
                  className="h-4 w-4 mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <label
                  htmlFor="del-confirm"
                  className="text-xs text-slate-700 cursor-pointer leading-normal select-none"
                >
                  I understand that once the admin approves, all my campaigns, connected accounts,
                  and history will be permanently deleted.
                </label>
              </div>

              {/* Form buttons */}
              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDeleteModal(false)}
                  className="text-xs h-9 cursor-pointer border border-slate-200 bg-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={submittingDelete || !deleteReason || !confirmDeleteCheck}
                  className="text-xs h-9 bg-rose-600 hover:bg-rose-700 text-white cursor-pointer font-bold shadow-sm"
                >
                  {submittingDelete ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Submit Request'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
