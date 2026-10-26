"use client";
import React from "react";
import { useAuthorization } from "@/lib/authz";

interface PermissionGateProps {
  action: string;
  resource: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function PermissionGate({ action, resource, children, fallback = null }: PermissionGateProps) {
  const { can } = useAuthorization();
  if (!can(action, resource)) return <>{fallback}</>;
  return <>{children}</>;
}


