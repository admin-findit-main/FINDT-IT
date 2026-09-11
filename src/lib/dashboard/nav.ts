export type DashItem = {
  href: string;
  label: string;
  icon:
    | "overview"
    | "requests"
    | "responses"
    | "demand"
    | "staff"
    | "hub"
    | "shifts"
    | "devices"
    | "store"
    | "plan"
    | "rewards"
    | "alerts"
    | "account"
    | "settings"
    | "applications"
    | "stores"
    | "users"
    | "analytics"
    | "reports"
    | "system";
  /** Sidebar group label; consecutive items with the same section render under one header. */
  section?: string;
};

export const ownerDashItems: DashItem[] = [
  { href: "/store", label: "Overview", icon: "overview", section: "Today" },
  { href: "/store/requests", label: "Requests", icon: "requests", section: "Asks" },
  { href: "/store/responses", label: "Responses", icon: "responses", section: "Asks" },
  { href: "/store/demand", label: "Demand", icon: "demand", section: "Asks" },
  { href: "/store/customers", label: "Customers", icon: "users", section: "Loyalty" },
  { href: "/store/rewards", label: "Rewards", icon: "rewards", section: "Loyalty" },
  { href: "/store/locations/add", label: "Locations", icon: "stores", section: "Loyalty" },
  { href: "/store/shifts", label: "Staff", icon: "shifts", section: "People" },
  { href: "/store/hub", label: "FINDIT Hub", icon: "hub", section: "Counter" },
  { href: "/store/devices", label: "Devices", icon: "devices", section: "Counter" },
  { href: "/store/notifications", label: "Notifications", icon: "alerts", section: "Account" },
  { href: "/store/settings", label: "Settings", icon: "settings", section: "Account" },
  { href: "/store/subscription", label: "Billing", icon: "plan", section: "Account" },
];

export const employeeDashItems: DashItem[] = [
  { href: "/store/hub", label: "FINDIT Hub", icon: "hub", section: "Floor" },
  { href: "/store/requests", label: "Requests", icon: "requests", section: "Floor" },
  { href: "/store/notifications", label: "Notifications", icon: "alerts", section: "Account" },
  { href: "/store/account", label: "Account", icon: "account", section: "Account" },
];

/**
 * Owner Business uses sidebar (desktop) / drawer (mobile) only — no bottom tab bar.
 * Employees keep a short phone tab bar for the few destinations they use.
 */
export const ownerMobileDashItems: DashItem[] = [];

export const employeeMobileDashItems: DashItem[] = [
  { href: "/store/hub", label: "Hub", icon: "hub" },
  { href: "/store/requests", label: "Asks", icon: "requests" },
  { href: "/store/notifications", label: "Alerts", icon: "alerts" },
  { href: "/store/account", label: "Account", icon: "account" },
];

export const adminMobileDashItems: DashItem[] = [
  { href: "/admin", label: "Home", icon: "overview" },
  { href: "/admin/applications", label: "Join", icon: "applications" },
  { href: "/admin/stores", label: "Stores", icon: "stores" },
  { href: "/admin/reports", label: "Trust", icon: "reports" },
  { href: "/admin/notifications", label: "Alerts", icon: "alerts" },
];

export const adminDashItems: DashItem[] = [
  { href: "/admin", label: "Command", icon: "overview", section: "Today" },
  { href: "/admin/applications", label: "Applications", icon: "applications", section: "Growth" },
  { href: "/admin/waitlist", label: "Waitlist", icon: "users", section: "Growth" },
  { href: "/admin/stores", label: "Stores", icon: "stores", section: "Network" },
  { href: "/admin/shoppers", label: "Shoppers", icon: "users", section: "Network" },
  { href: "/admin/owners", label: "Owners", icon: "staff", section: "Network" },
  { href: "/admin/hubs", label: "Hubs", icon: "devices", section: "Network" },
  { href: "/admin/requests", label: "Finds", icon: "requests", section: "Network" },
  { href: "/admin/subscriptions", label: "Billing", icon: "plan", section: "Money" },
  { href: "/admin/notifications", label: "Broadcast", icon: "alerts", section: "Reach" },
  { href: "/admin/reports", label: "Reports", icon: "reports", section: "Trust" },
  { href: "/admin/audit", label: "Audit", icon: "reports", section: "Trust" },
  { href: "/admin/analytics", label: "Analytics", icon: "analytics", section: "Insight" },
  { href: "/admin/system", label: "System", icon: "system", section: "Insight" },
];

export function dashTitle(pathname: string): { title: string; subtitle: string } {
  const map: Record<string, { title: string; subtitle: string }> = {
    "/store": { title: "Overview", subtitle: "Today at this location" },
    "/store/requests": { title: "Requests", subtitle: "Nearby customer asks" },
    "/store/customers": { title: "Customers", subtitle: "Loyalty and messages" },
    "/store/rewards": {
      title: "Rewards",
      subtitle: "Loyalty points for this store",
    },
    "/store/locations/add": {
      title: "Add location",
      subtitle: "Apply with your current login",
    },
    "/store/responses": { title: "Responses", subtitle: "Past answers" },
    "/store/demand": { title: "Demand", subtitle: "Popular nearby asks" },
    "/store/team": {
      title: "Staff",
      subtitle: "PINs, hours, and logins",
    },
    "/store/shifts": {
      title: "Staff",
      subtitle: "PINs, hours, and logins",
    },
    "/store/devices": { title: "Devices", subtitle: "Hub tablets" },
    "/store/settings": { title: "Settings", subtitle: "Store details" },
    "/store/subscription": { title: "Billing", subtitle: "Plan and payments" },
    "/store/notifications": { title: "Notifications", subtitle: "Alerts" },
    "/store/account": { title: "Account", subtitle: "Your login" },
    "/admin": { title: "Command", subtitle: "Network operations" },
    "/admin/notifications": {
      title: "Broadcast",
      subtitle: "Messages to shoppers and stores",
    },
    "/admin/applications": { title: "Applications", subtitle: "Stores waiting to join" },
    "/admin/waitlist": { title: "Waitlist", subtitle: "Website signups" },
    "/admin/stores": { title: "Stores", subtitle: "Locations" },
    "/admin/shoppers": { title: "Shoppers", subtitle: "Customer accounts" },
    "/admin/owners": { title: "Owners", subtitle: "Store owners" },
    "/admin/audit": { title: "Audit", subtitle: "Sensitive actions" },
    "/admin/subscriptions": { title: "Billing", subtitle: "Trials and FastSpring" },
    "/admin/hubs": { title: "Hubs", subtitle: "Paired tablets" },
    "/admin/requests": { title: "Finds", subtitle: "Recent asks" },
    "/admin/reports": { title: "Reports", subtitle: "Moderation queue" },
    "/admin/analytics": { title: "Analytics", subtitle: "Pilot metrics" },
    "/admin/system": { title: "System", subtitle: "Health" },
  };
  if (pathname.startsWith("/store/requests/")) {
    return { title: "Request", subtitle: "Store response detail" };
  }
  if (pathname.startsWith("/admin/stores/")) {
    return { title: "Store", subtitle: "People and settings at this location" };
  }
  return map[pathname] || { title: "FINDIT", subtitle: "" };
}

export function dashItemActive(pathname: string, href: string) {
  if (href === "/store" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}
