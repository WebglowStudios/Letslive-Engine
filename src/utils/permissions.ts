import { IUser } from '../models/User.js';

export type Role = "admin" | "manager" | "staff" | "guest" | "user" | "sales-manager" | "sales-staff" | "ops-manager" | "ops-staff";

export type Permission =
  | "dashboard.view"
  | "bookings.view"
  | "bookings.update"
  | "bookings.delete"
  | "destinations.view"
  | "destinations.create"
  | "destinations.edit"
  | "destinations.delete"
  | "packages.view"
  | "packages.create"
  | "packages.edit"
  | "packages.delete"
  | "users.view"
  | "users.edit"
  | "users.delete"
  | "staff.view"
  | "staff.create"
  | "staff.edit"
  | "staff.delete"
  | "reviews.view"
  | "reviews.edit"
  | "reviews.approve"
  | "reviews.delete"
  | "enquiries.view"
  | "enquiries.respond"
  | "enquiries.delete"
  | "careers.view"
  | "careers.create"
  | "careers.edit"
  | "careers.delete"
  | "newsletter.view"
  | "newsletter.export"
  | "settings.view"
  | "settings.edit"
  | "activity.view";

export const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    "dashboard.view",
    "bookings.view", "bookings.update", "bookings.delete",
    "destinations.view", "destinations.create", "destinations.edit", "destinations.delete",
    "packages.view", "packages.create", "packages.edit", "packages.delete",
    "users.view", "users.edit", "users.delete",
    "staff.view", "staff.create", "staff.edit", "staff.delete",
    "reviews.view", "reviews.edit", "reviews.approve", "reviews.delete",
    "enquiries.view", "enquiries.respond", "enquiries.delete",
    "careers.view", "careers.create", "careers.edit", "careers.delete",
    "newsletter.view", "newsletter.export",
    "settings.view", "settings.edit",
    "activity.view",
  ],
  manager: [
    "dashboard.view",
    "bookings.view", "bookings.update",
    "destinations.view", "destinations.create", "destinations.edit", "destinations.delete",
    "packages.view", "packages.create", "packages.edit", "packages.delete",
    "users.view", "users.edit",
    "reviews.view", "reviews.edit", "reviews.approve", "reviews.delete",
    "enquiries.view", "enquiries.respond",
    "careers.view", "careers.create", "careers.edit", "careers.delete",
    "newsletter.view",
    "activity.view",
  ],
  "sales-manager": [
    "dashboard.view",
    "enquiries.view", "enquiries.respond", "enquiries.delete",
    "packages.view",
    "destinations.view",
    "users.view",
    "activity.view",
  ],
  "sales-staff": [
    "dashboard.view",
    "enquiries.view", "enquiries.respond",
    "activity.view",
  ],
  "ops-manager": [
    "dashboard.view",
    "bookings.view", "bookings.update", "bookings.delete",
    "destinations.view",
    "packages.view",
    "users.view",
    "activity.view",
  ],
  "ops-staff": [
    "dashboard.view",
    "bookings.view", "bookings.update",
    "activity.view",
  ],
  staff: [
    "dashboard.view",
    "bookings.view", "bookings.update",
    "destinations.view", "destinations.create", "destinations.edit",
    "packages.view", "packages.create", "packages.edit",
    "reviews.view",
    "enquiries.view", "enquiries.respond",
    "careers.view",
    "activity.view",
  ],
  guest: [
    "dashboard.view",
    "bookings.view",
    "destinations.view",
    "packages.view",
    "reviews.view",
    "enquiries.view",
    "careers.view",
  ],
  user: [],
};

export function hasPermission(user: IUser, permission: Permission): boolean {
  if (!user) return false;

  // 1. Check if user's role inherently has this permission
  if (rolePermissions[user.role as Role]?.includes(permission)) {
    return true;
  }

  // 2. Check for active custom permission
  const now = new Date();
  const custom = user.customPermissions?.find(p => p.permission === permission);
  
  if (custom) {
    if (!custom.expiresAt) return true;
    if (new Date(custom.expiresAt) > now) return true;
  }

  return false;
}
