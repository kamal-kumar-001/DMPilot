'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/components/dashboard/layout';
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
} from 'lucide-react';
import { Button, Input, Label, toast } from '@autodm/ui';
import { apiRequest } from '@/lib/api-client';
import { ConnectedAccounts } from '@/components/dashboard/connected-accounts';
import { CustomSelect } from '@/components/ui/custom-select';

type SettingTab = 'profile' | 'security' | 'channels' | 'billing' | 'preferences';

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const [activeTab, setActiveTab] = React.useState<SettingTab>('profile');

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

  const userEmail = session?.user?.email || 'user@autodm.com';
  const userRole = session?.user?.role || 'CREATOR';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Title */}
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Settings</h1>
          <p className="text-xs text-slate-600">
            Manage account options, channels, and security settings
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Tab Navigation Menu */}
          <div className="flex flex-col space-y-1">
            {[
              { id: 'profile' as const, label: 'Profile Options', icon: User },
              { id: 'security' as const, label: 'Security & Access', icon: Lock },
              { id: 'channels' as const, label: 'Instagram Channels', icon: Globe },
              { id: 'billing' as const, label: 'Billing & Plan', icon: CreditCard },
              { id: 'preferences' as const, label: 'Preferences', icon: Bell },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
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
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Verified ✓
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
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
                      className="bg-white/5 text-gray-400 border-white/5 select-none cursor-not-allowed"
                    />
                    <span className="text-[9px] text-gray-500 flex items-center space-x-1">
                      <Shield className="h-3 w-3" />
                      <span>Email address cannot be changed. Contact support if needed.</span>
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="prof-role">User Role</Label>
                    <Input
                      id="prof-role"
                      value={userRole}
                      disabled
                      className="bg-white/5 text-gray-400 border-white/5 select-none cursor-not-allowed capitalize"
                    />
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
                        onClick={() => {
                          setDeleteReason('');
                          setDeleteFeedback('');
                          setConfirmDeleteCheck(false);
                          setShowDeleteModal(true);
                        }}
                        size="sm"
                        className="text-xs h-9 bg-rose-600 hover:bg-rose-700 border-0 text-white cursor-pointer font-bold shadow-sm"
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
                    variant="secondary"
                    className="font-semibold text-xs h-9 w-36 cursor-pointer"
                    disabled={changingPassword}
                  >
                    {changingPassword ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
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
                  <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-xl border border-white/5">
                    <input
                      id="pref-email"
                      type="checkbox"
                      checked={emailNotify}
                      onChange={(e) => setEmailNotify(e.target.checked)}
                      className="h-4 w-4 rounded border-white/10 bg-white/5 text-primary focus:ring-primary"
                    />
                    <div className="flex flex-col">
                      <Label htmlFor="pref-email" className="font-semibold cursor-pointer">
                        Email reports
                      </Label>
                      <span className="text-[9px] text-gray-500">
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
                  size="sm"
                  disabled={submittingDelete || !deleteReason || !confirmDeleteCheck}
                  className="text-xs h-9 bg-rose-600 hover:bg-rose-700 border-0 text-white cursor-pointer font-bold shadow-sm"
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
    </DashboardLayout>
  );
}

function SettingsBilling() {
  const { data: session, update: updateSession } = useSession();
  const [plans, setPlans] = React.useState<any[]>([]);
  const [subscription, setSubscription] = React.useState<any>(null);
  const [usage, setUsage] = React.useState<any>(null);
  const [invoices, setInvoices] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isAnnual, setIsAnnual] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);

  const [showCancelModal, setShowCancelModal] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState('');
  const [cancelFeedback, setCancelFeedback] = React.useState('');

  const fetchData = async () => {
    try {
      const [plansData, subData, usageData, invoiceData] = await Promise.all([
        apiRequest<any[]>('/billing/plans'),
        apiRequest<any>('/billing/subscription'),
        apiRequest<any>('/billing/usage'),
        apiRequest<any[]>('/billing/invoices').catch(() => []),
      ]);
      setPlans(plansData || []);
      setSubscription(subData);
      setUsage(usageData);
      setInvoices(invoiceData || []);

      if (subData?.plan && subData.plan !== session?.user?.plan) {
        updateSession({
          user: {
            ...session?.user,
            plan: subData.plan,
          },
        }).catch(() => null);
      }
    } catch (e) {
      console.error('Failed to load billing metrics', e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      toast.success('Successfully upgraded! Welcome to the premium DMPilot family.', {
        id: 'billing-upgrade-toast',
      });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('payment') === 'cancel') {
      toast.error('Payment checkout session was cancelled.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleUpgrade = (planKey: string) => {
    if (planKey === 'ENTERPRISE' || planKey === 'AGENCY') {
      window.location.href = '/contact?subject=Agency';
      return;
    }
    const cycle = isAnnual ? 'YEARLY' : 'MONTHLY';
    window.location.href = `/checkout?plan=${planKey}&cycle=${cycle}`;
  };

  const handleCancelSubscription = async () => {
    setCancelling(true);
    try {
      await apiRequest('/billing/cancel', {
        method: 'POST',
        body: JSON.stringify({
          reason: cancelReason,
          feedback: cancelFeedback,
        }),
      });
      toast.success(
        'Subscription cancelled. Your access will remain active until the end of your billing cycle.',
      );
      setShowCancelModal(false);
      fetchData();
    } catch (e) {
      toast.error('Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  const handleDownloadReceipt = (invoice: any) => {
    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>DMPilot Tax Invoice - ${invoice.id.slice(0, 8)}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #111; background: #fff; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .logo { font-size: 24px; font-weight: 800; color: #00BB88; }
            .title { font-size: 20px; font-weight: 700; text-align: right; color: #333; }
            .details { margin: 30px 0; display: flex; justify-content: space-between; font-size: 14px; line-height: 1.6; }
            .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .table th, .table td { border-bottom: 1px solid #eee; padding: 12px; text-align: left; font-size: 14px; }
            .table th { background: #f9f9f9; font-weight: 600; }
            .total { font-size: 18px; font-weight: 800; text-align: right; margin-top: 20px; }
            .footer { margin-top: 50px; font-size: 12px; color: #777; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px; text-align: right;">
            <button onclick="window.print()" style="background: #00BB88; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer;">Print Receipt</button>
          </div>
          <div class="header">
            <div>
              <div class="logo">⚡ DMPilot</div>
              <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Automated Instagram DM & Growth Platform</p>
            </div>
            <div class="title">
              TAX INVOICE / RECEIPT
              <p style="font-size: 12px; font-weight: normal; color: #666; margin: 4px 0 0 0;">Invoice ID: ${invoice.id}</p>
              <p style="font-size: 12px; font-weight: normal; color: #666; margin: 2px 0 0 0;">Date: ${new Date(invoice.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          <div class="details">
            <div>
              <strong>Billed To:</strong><br/>
              ${invoice.billingDetails?.name || 'Valued Creator'}<br/>
              ${invoice.billingDetails?.email || ''}<br/>
              ${invoice.billingDetails?.phone || ''}<br/>
              ${invoice.billingDetails?.address || ''}<br/>
              ${invoice.billingDetails?.city || ''} ${invoice.billingDetails?.pincode || ''}<br/>
              ${invoice.billingDetails?.gstin ? `GSTIN: ${invoice.billingDetails.gstin}` : ''}
            </div>
            <div style="text-align: right;">
              <strong>Payment Status:</strong> <span style="color: #00BB88; font-weight: bold;">PAID</span><br/>
              <strong>Payment Method:</strong> Razorpay Gateway<br/>
              <strong>Payment ID:</strong> ${invoice.paymentId || 'pay_link_success'}<br/>
            </div>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Billing Cycle</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>DMPilot ${invoice.plan} Subscription Plan</td>
                <td>${invoice.cycle || 'MONTHLY'}</td>
                <td>₹${Math.round(invoice.amount / 1.18).toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td colspan="2" style="text-align: right;"><strong>Estimated Tax (18% GST):</strong></td>
                <td>₹${Math.round(invoice.amount - invoice.amount / 1.18).toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
          <div class="total">
            Total Paid: ₹${invoice.amount.toLocaleString('en-IN')} ${invoice.currency}
          </div>
          <div class="footer">
            Thank you for choosing DMPilot! For support inquiries, contact support@dmpilot.org.
          </div>
        </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(receiptHtml);
      printWin.document.close();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-2">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
        <p className="text-xs text-gray-500">Loading plan subscription parameters...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current plan metrics banner */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-6 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-sm animate-in fade-in duration-200">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Current Tier
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[9px] font-bold text-emerald-700">
              {subscription?.plan || 'FREE'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-bold text-slate-600">
              {subscription?.cycle || 'MONTHLY'}
            </span>
          </div>
          <h4 className="text-sm font-extrabold text-slate-900">
            {subscription?.plan === 'FREE'
              ? 'Free Trial Subscription'
              : `${subscription?.plan} Creator Plan Active`}
          </h4>
          {subscription?.expiresAt && (
            <p className="text-[9px] text-slate-500">
              Renews / expires on:{' '}
              <strong className="text-slate-800">
                {new Date(subscription.expiresAt).toLocaleDateString()}
              </strong>
            </p>
          )}
        </div>

        {/* Usage stats bars */}
        {usage?.usage && (
          <div className="space-y-3 min-w-[200px]">
            {usage.usage.map((u: any) => (
              <div key={u.metric} className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-600 capitalize">
                    {u.metric.replace('max_', '').replace('_', ' ')}
                  </span>
                  <span className="text-slate-500 font-medium">
                    {u.used} / {u.unlimited ? '∞' : u.limit}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent-cyan transition-all duration-300"
                    style={{ width: `${u.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly / Annual Cycle Toggle */}
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-xl border border-slate-200/80 p-3 rounded-2xl shadow-sm">
        <div>
          <h5 className="text-xs font-bold text-slate-900">Choose Billing Cycle</h5>
          <p className="text-[10px] text-slate-500">
            Save 20% on annual subscriptions with instant activation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAnnual(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              !isAnnual ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setIsAnnual(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              isAnnual ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Annual
            <span className="bg-emerald-50 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded-full font-bold border border-emerald-200">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Plans selector grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-300">
        {plans.map((plan: any) => {
          const planKey = plan.key;
          const isCurrent = planKey === subscription?.plan;
          const isAgency =
            planKey === 'ENTERPRISE' || planKey === 'AGENCY' || plan.label === 'Agency';

          return (
            <div
              key={planKey}
              className={`bg-white border border-slate-200/80 relative p-6 rounded-2xl flex flex-col justify-between h-full shadow-sm hover:shadow-md transition-all ${
                isCurrent ? 'ring-2 ring-emerald-500/40 border-emerald-400' : ''
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 right-5 bg-gradient-to-r from-primary to-accent-cyan text-primary-foreground text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full shadow-md">
                  Popular
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-slate-900">{plan.name || planKey}</h4>
                  <p className="text-[10px] text-slate-500 leading-normal min-h-[30px]">
                    {plan.description}
                  </p>
                </div>

                {/* Pricing Display */}
                {isAgency ? (
                  <div className="space-y-0.5">
                    <div className="text-2xl font-extrabold text-slate-900">Contact Us</div>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Custom enterprise pricing
                    </p>
                  </div>
                ) : planKey === 'FREE' ? (
                  <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-extrabold text-slate-900">₹0</span>
                    <span className="text-[10px] text-slate-500">/month</span>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <div className="flex items-baseline space-x-1">
                      <span className="text-2xl font-extrabold text-slate-900">
                        {isAnnual
                          ? `₹${Math.round((plan.priceYearly || 9990) / 12).toLocaleString('en-IN')}`
                          : `₹${(plan.priceMonthly || 999).toLocaleString('en-IN')}`}
                      </span>
                      <span className="text-[10px] text-slate-500">/month</span>
                    </div>
                    {isAnnual ? (
                      <p className="text-[10px] text-emerald-700 font-mono font-bold">
                        billed annually (₹{(plan.priceYearly || 9990).toLocaleString('en-IN')}/yr)
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-500 font-mono">billed monthly</p>
                    )}
                  </div>
                )}

                <ul className="space-y-2 text-[10px] text-slate-600 border-t border-slate-100 pt-4">
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                    <span>
                      {plan.campaignLimit === -1 ? 'Unlimited' : plan.campaignLimit} Campaigns
                    </span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                    <span>
                      {plan.dmLimitMonthly === -1
                        ? 'Unlimited'
                        : plan.dmLimitMonthly.toLocaleString()}{' '}
                      DMs / month
                    </span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                    <span>
                      {plan.keywordLimit === -1 ? 'Unlimited' : plan.keywordLimit} Keywords
                    </span>
                  </li>
                </ul>
              </div>

              <div className="pt-5 border-t border-slate-100 mt-5">
                <Button
                  onClick={() => handleUpgrade(planKey)}
                  disabled={isCurrent}
                  className={`w-full text-xs font-bold ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed select-none'
                      : planKey === 'FREE'
                        ? 'border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary cursor-pointer shadow-sm'
                        : isAgency
                          ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-sm'
                          : 'bg-gradient-to-r from-primary to-accent-cyan hover:opacity-95 text-white border-0 shadow-brand hover:shadow-brand-lg cursor-pointer'
                  }`}
                >
                  {isCurrent
                    ? 'Active Plan'
                    : planKey === 'FREE'
                      ? 'Downgrade to Free'
                      : isAgency
                        ? 'Contact Agency Sales'
                        : 'Select Plan'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Invoice History & Receipt Section */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Invoice History & Receipts</h4>
            <p className="text-[10px] text-slate-500">
              Download formatted tax receipts for accounting
            </p>
          </div>
          {subscription?.plan !== 'FREE' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelModal(true)}
                disabled={cancelling}
                className="text-[10px] border-rose-200 text-rose-600 hover:bg-rose-50 h-7"
              >
                Cancel Auto-Renewal
              </Button>

              {/* Cancellation Feedback Modal */}
              <AnimatePresence>
                {showCancelModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowCancelModal(false)}
                      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs cursor-pointer"
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="w-full max-w-md bg-white border border-slate-200 p-6 rounded-3xl shadow-2xl z-10 space-y-4 font-sans relative animate-in fade-in duration-200"
                    >
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">
                          Cancel Subscription Auto-Renewal
                        </h3>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          We are sad to see you go. Please let us know why you are cancelling your
                          auto-renewal. Your premium access will remain active until the end of your
                          current billing period.
                        </p>
                      </div>

                      {/* Cancellation reason CustomSelect */}
                      <div className="space-y-1.5 border-t border-slate-100 pt-3">
                        <Label htmlFor="cancel-reason" className="text-slate-800">
                          Reason for cancelling
                        </Label>
                        <CustomSelect
                          id="cancel-reason"
                          value={cancelReason}
                          onChange={(val) => setCancelReason(val)}
                          placeholder="Select a reason..."
                          options={[
                            { value: 'Too Expensive', label: 'Pricing is too high' },
                            { value: 'Missing Features', label: 'Missing key features' },
                            { value: 'Alternative Found', label: 'Switched to another product' },
                            { value: 'Technical Issues', label: 'Too many bugs / difficult setup' },
                            { value: 'Other', label: 'Other reason' },
                          ]}
                        />
                      </div>

                      {/* Feedback text area */}
                      <div className="space-y-1.5">
                        <Label htmlFor="cancel-feedback" className="text-slate-800">
                          Any additional feedback? (Optional)
                        </Label>
                        <textarea
                          id="cancel-feedback"
                          value={cancelFeedback}
                          onChange={(e) => setCancelFeedback(e.target.value)}
                          placeholder="Tell us how we can improve DMPilot..."
                          className="w-full h-20 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                        />
                      </div>

                      <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => setShowCancelModal(false)}
                          className="h-9 px-4 text-xs font-semibold"
                        >
                          Keep Subscription
                        </Button>
                        <button
                          type="button"
                          onClick={handleCancelSubscription}
                          disabled={cancelling || !cancelReason}
                          className="h-9 px-4 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {invoices.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            No payment receipts found yet. Subscriptions will generate receipts here automatically.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Invoice ID</th>
                  <th className="py-2.5 px-3">Plan</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                      {inv.id.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {inv.plan} ({inv.cycle})
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      ₹{inv.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold">
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleDownloadReceipt(inv)}
                        className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[10px] font-semibold text-emerald-700 transition-all inline-flex items-center gap-1 cursor-pointer"
                      >
                        Download Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
