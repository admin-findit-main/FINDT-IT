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
  { href: "/store/team", label: "Team", icon: "staff", section: "People" },
  { href: "/store/shifts", label: "Shifts", icon: "shifts", section: "People" },
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

/** Phone tab bar — keep to 5 short labels. Full list stays in the sidebar menu. */
export const ownerMobileDashItems: DashItem[] = [
  { href: "/store", label: "Home", icon: "overview" },
  { href: "/store/requests", label: "Asks", icon: "requests" },
  { href: "/store/team", label: "Team", icon: "staff" },
  { href: "/store/hub", label: "Hub", icon: "hub" },
  { href: "/store/settings", label: "Settings", icon: "settings" },
];

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
    "/store": { title: "Overview", subtitle: "Everything for this location" },
    "/store/requests": { title: "Requests", subtitle: "Answer nearby asks" },
    "/store/customers": { title: "Customers", subtitle: "People connected to this store" },
    "/store/rewards": { title: "Rewards", subtitle: "Store-funded points and value" },
    "/store/responses": { title: "Responses", subtitle: "What your team already answered" },
    "/store/demand": { title: "Demand", subtitle: "What people nearby keep asking for" },
    "/store/team": {
      title: "Team",
      subtitle: "Managers and employees with FINDIT login access",
    },
    "/store/shifts": {
      title: "Shifts",
      subtitle: "Floor staff, Hub PINs, and punch hours",
    },
    "/store/devices": { title: "Devices", subtitle: "Counter tablets connected to this store" },
    "/store/settings": { title: "Settings", subtitle: "Store profile, hours, coverage, categories" },
    "/store/subscription": { title: "Billing", subtitle: "Subscription and payment status" },
    "/store/notifications": { title: "Notifications", subtitle: "New asks and team updates" },
    "/store/account": { title: "Account", subtitle: "Your login" },
    "/admin": { title: "Command", subtitle: "Run the FINDIT network from one desk" },
    "/admin/notifications": {
      title: "Broadcast",
      subtitle: "Push a message to shoppers, owners, or employees",
    },
    "/admin/applications": { title: "Applications", subtitle: "Approve stores waiting to join" },
    "/admin/waitlist": { title: "Waitlist", subtitle: "People who signed up from the website" },
    "/admin/stores": { title: "Stores", subtitle: "Open a location for people and settings" },
    "/admin/shoppers": { title: "Shoppers", subtitle: "Customer accounts" },
    "/admin/owners": { title: "Owners", subtitle: "People who own a store" },
    "/admin/audit": { title: "Audit", subtitle: "Security-sensitive actions" },
    "/admin/subscriptions": { title: "Billing", subtitle: "Trials, complimentary access, FastSpring" },
    "/admin/hubs": { title: "Hubs", subtitle: "Paired counter tablets across the network" },
    "/admin/requests": { title: "Finds", subtitle: "Recent shopper asks" },
    "/admin/reports": { title: "Reports", subtitle: "Moderation queue — resolve or dismiss" },
    "/admin/analytics": { title: "Analytics", subtitle: "Pilot KPIs and recent activity" },
    "/admin/system": { title: "System", subtitle: "Live health and environment" },
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
