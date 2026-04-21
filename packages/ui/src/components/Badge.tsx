"use client";

import React from "react";
import { cn } from "../cn";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";
type TriageLevel = "low" | "moderate" | "high" | "emergency";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    default: "bg-gray-100 text-gray-700",
    success: "bg-green-100 text-green-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800",
  };
  return (
    <span
      className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold", variants[variant], className)}
      {...props}
    >
      {children}
    </span>
  );
}

// Triage-level badge
export function TriageBadge({ level }: { level: TriageLevel }) {
  const map: Record<TriageLevel, { variant: BadgeVariant; label: string; dot: string }> = {
    low:       { variant: "success", label: "Low Priority",  dot: "bg-green-500" },
    moderate:  { variant: "warning", label: "Moderate",      dot: "bg-amber-500" },
    high:      { variant: "danger",  label: "High Priority", dot: "bg-orange-500" },
    emergency: { variant: "danger",  label: "EMERGENCY",     dot: "bg-red-600 animate-pulse" },
  };
  const { variant, label, dot } = map[level];
  return (
    <Badge variant={variant}>
      <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
      {label}
    </Badge>
  );
}

// Doctor status badge
export function DoctorStatusBadge({ status }: { status: "available" | "in_session" | "offline" | "busy" }) {
  const map = {
    available:  { variant: "success" as BadgeVariant, label: "Available",   dot: "bg-green-500" },
    in_session: { variant: "warning" as BadgeVariant, label: "In Session",  dot: "bg-amber-500" },
    busy:       { variant: "warning" as BadgeVariant, label: "Busy",        dot: "bg-orange-500" },
    offline:    { variant: "default" as BadgeVariant, label: "Offline",     dot: "bg-gray-400" },
  };
  const { variant, label, dot } = map[status];
  return (
    <Badge variant={variant}>
      <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
      {label}
    </Badge>
  );
}
