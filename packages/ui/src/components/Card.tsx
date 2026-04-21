"use client";

import React from "react";
import { cn } from "../cn";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "bordered" | "elevated";
  clickable?: boolean;
}

export function Card({ variant = "default", clickable = false, className, children, ...props }: CardProps) {
  const base = "bg-white rounded-2xl overflow-hidden";
  const variants = {
    default: "shadow-card",
    bordered: "border border-gray-200",
    elevated: "shadow-card-hover",
  };
  return (
    <div
      className={cn(base, variants[variant], clickable && "cursor-pointer hover:shadow-card-hover transition-shadow duration-200", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn("px-4 py-3 border-b border-gray-100", className)} {...props}>
      {children}
    </div>
  );
}

interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {}
export function CardBody({ className, children, ...props }: CardBodyProps) {
  return (
    <div className={cn("px-4 py-4", className)} {...props}>
      {children}
    </div>
  );
}
