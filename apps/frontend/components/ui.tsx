"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function Card({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-card ${className}`}
      {...props}
    />
  );
}

export function Label({ className = "", ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`mb-1.5 block text-sm font-medium text-slate-700 ${className}`} {...props} />
  );
}

const fieldClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldClass} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${fieldClass} ${className}`} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldClass} ${className}`} {...props} />;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}

const variantClass: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-500/60",
  secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
  danger: "bg-red-50 text-red-600 hover:bg-red-100",
};

const sizeClass: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...props}
    />
  );
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function Badge({
  tone = "slate",
  children,
}: {
  tone?: "slate" | "brand" | "blue" | "amber" | "red";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600",
    brand: "bg-brand-100 text-brand-700",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
