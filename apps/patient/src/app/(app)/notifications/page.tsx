"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import type { Notification } from "@zambuko/database";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function NotificationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data: notifications = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["patient-notifications"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      if (!notificationIds.length) return;
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in("id", notificationIds);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patient-notifications"] }),
    onError: () => toast.error("Notification status could not be updated."),
  });

  const visible = unreadOnly ? notifications.filter((item) => !item.is_read) : notifications;
  const unread = notifications.filter((item) => !item.is_read);

  function safeActionUrl(url: string | null) {
    return url?.startsWith("/") && !url.startsWith("//") ? url : "/dashboard";
  }

  return (
    <div className="min-h-app bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur lg:px-8">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Updates</p>
            <h1 className="mt-1 text-xl font-bold text-slate-950">Notifications</h1>
            <p className="mt-1 text-sm text-slate-500">{unread.length ? `${unread.length} unread update${unread.length === 1 ? "" : "s"}` : "You’re all caught up."}</p>
          </div>
          {unread.length > 0 && (
            <button type="button" disabled={markRead.isPending} onClick={() => markRead.mutate(unread.map((item) => item.id))} className="min-h-10 rounded-lg px-3 text-sm font-bold text-brand-700 hover:bg-brand-50 disabled:opacity-50">
              Mark all read
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5 lg:px-8">
        <label className="mb-4 flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} className="h-4 w-4 accent-brand-700" />
          Unread only
        </label>

        {isLoading && <div className="space-y-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-200" />)}</div>}

        {isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
            <h2 className="font-bold text-red-900">Notifications are unavailable</h2>
            <button type="button" onClick={() => refetch()} className="mt-4 min-h-10 rounded-lg bg-red-700 px-4 text-sm font-bold text-white">Try again</button>
          </div>
        )}

        {!isLoading && !isError && visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <h2 className="font-bold text-slate-900">{unreadOnly ? "No unread notifications" : "No notifications yet"}</h2>
            <p className="mt-1 text-sm text-slate-500">Appointment, prescription, payment, and emergency updates will appear here.</p>
          </div>
        )}

        {!isLoading && !isError && visible.length > 0 && (
          <div className="space-y-2">
            {visible.map((notification) => (
              <Link
                key={notification.id}
                href={safeActionUrl(notification.action_url)}
                onClick={() => !notification.is_read && markRead.mutate([notification.id])}
                className={`block rounded-xl border p-4 transition-colors ${
                  notification.is_read ? "border-slate-200 bg-white hover:bg-slate-50" : "border-brand-200 bg-brand-50 hover:bg-brand-100"
                }`}
              >
                <div className="flex gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 flex-none rounded-full ${notification.is_read ? "bg-slate-300" : "bg-brand-600"}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-bold text-slate-900">{notification.title}</h2>
                      <span className="whitespace-nowrap text-[11px] text-slate-400">{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}</span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{notification.body}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
