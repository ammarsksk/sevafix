"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ProtectedRoute } from "@/components/route-guards";
import {
  Button,
  Card,
  ConfirmModal,
  ErrorBanner,
  FullPageSpinner,
  PageHeader,
  TextField,
} from "@/components/ui";
import { useAuth } from "@/lib/sevafix/auth-context";
import { useMe, useRequestAccountDeletion, useUpdateMe } from "@/lib/sevafix/queries";
import type { UserProfile } from "@/lib/sevafix/sevafix-types";

function ProfileForm({ profile }: { profile: UserProfile }) {
  const updateMe = useUpdateMe();
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [locale, setLocale] = useState(profile.locale ?? "en");
  const [notificationEmail, setNotificationEmail] = useState(profile.notificationEmail ?? "");
  const [notificationOptIn, setNotificationOptIn] = useState(Boolean(profile.notificationOptIn));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function onSave() {
    setSaveError(null);
    try {
      await updateMe.mutateAsync({ displayName, locale, notificationEmail, notificationOptIn });
      setSavedAt(new Date());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save settings");
    }
  }

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold text-slate-700">Profile</h2>
      <ErrorBanner message={saveError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <TextField label="Locale" value={locale} onChange={(e) => setLocale(e.target.value)} />
        <TextField
          label="Notification email"
          type="email"
          value={notificationEmail}
          onChange={(e) => setNotificationEmail(e.target.value)}
        />
        <label className="flex items-center gap-2 self-end pb-2">
          <input
            type="checkbox"
            checked={notificationOptIn}
            onChange={(e) => setNotificationOptIn(e.target.checked)}
          />
          <span className="text-sm text-slate-800">Send me notification emails</span>
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={onSave} loading={updateMe.isPending}>
          Save
        </Button>
        {savedAt ? <span className="text-xs text-slate-500">Saved {savedAt.toLocaleTimeString()}</span> : null}
      </div>
    </Card>
  );
}

function SettingsContent() {
  const me = useMe();
  const requestDeletion = useRequestAccountDeletion();
  const { signOut } = useAuth();
  const router = useRouter();
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);

  if (me.isLoading || !me.data) return <FullPageSpinner />;

  async function onDeleteAccount() {
    setDeletionError(null);
    try {
      await requestDeletion.mutateAsync();
      await signOut();
      router.replace("/login");
    } catch (err) {
      setDeletionError(err instanceof Error ? err.message : "Could not queue account deletion");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" />

      <ProfileForm key={me.data.sub} profile={me.data} />

      <Card className="border-red-200">
        <h2 className="mb-2 text-sm font-semibold text-red-700">Delete account</h2>
        <p className="mb-4 text-sm text-slate-600">
          This permanently deletes your SevaFix account, applications, and documents. This cannot be undone.
        </p>
        <ErrorBanner message={deletionError} />
        <Button variant="danger" onClick={() => setConfirmingDeletion(true)}>
          Delete my account
        </Button>
      </Card>

      {confirmingDeletion ? (
        <ConfirmModal
          title="Delete your account?"
          description="This queues complete deletion of your account and signs you out. This cannot be undone."
          confirmLabel="Delete account"
          requireText="DELETE"
          danger
          onConfirm={onDeleteAccount}
          onClose={() => setConfirmingDeletion(false)}
          busy={requestDeletion.isPending}
        />
      ) : null}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}
