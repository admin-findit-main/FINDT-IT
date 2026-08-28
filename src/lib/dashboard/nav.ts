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
    | "devices"
    | "store"
    | "plan"
    | "alerts"
    | "account"
    | "applications"
    | "stores"
    | "users"
    | "analytics"
    | "reports"
    | "system";
};

export const ownerDashItems: DashItem[] = [
  { href: "/store", label: "Overview", icon: "overview" },
  { href: "/store/requests", label: "Requests", icon: "requests" },
  { href: "/store/responses", label: "Responses", icon: "responses" },
  { href: "/store/demand", label: "Demand", icon: "demand" },
  { href: "/store/hub", label: "FINDIT Hub", icon: "hub" },
  { href: "/store/devices", label: "Devices", icon: "devices" },
  { href: "/store/subscription", label: "Subscription", icon: "plan" },
];

export const employeeDashItems: DashItem[] = [
  { href: "/store/hub", label: "FINDIT Hub", icon: "hub" },
  { href: "/store/requests", label: "Requests", icon: "requests" },
  { href: "/store/notifications", label: "Notifications", icon: "alerts" },
];

export const adminDashItems: DashItem[] = [
  { href: "/admin", label: "Overview", icon: "overview" },
  { href: "/admin/applications", label: "Applications", icon: "applications" },
  { href: "/admin/stores", label: "Stores", icon: "stores" },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: "plan" },
  { href: "/admin/hubs", label: "FINDIT Hubs", icon: "devices" },
  { href: "/admin/reports", label: "Reports", icon: "reports" },
  { href: "/admin/analytics", label: "Analytics", icon: "analytics" },
  { href: "/admin/system", label: "System", icon: "system" },
];

export function dashTitle(pathname: string): { title: string; subtitle: string } {
  const map: Record<string, { title: string; subtitle: string }> = {
    "/store": { title: "Overview", subtitle: "Today at this location" },
    "/store/requests": { title: "Requests", subtitle: "Answer nearby asks" },
    "/store/responses": { title: "Responses", subtitle: "What your team already answered" },
    "/store/demand": { title: "Demand", subtitle: "What people nearby keep asking for" },
    "/store/team": { title: "Team", subtitle: "Who can answer on FINDIT" },
    "/store/devices": { title: "Devices", subtitle: "Counter tablets connected to this store" },
    "/store/settings": { title: "Store profile", subtitle: "How this location appears" },
    "/store/subscription": { title: "Subscription", subtitle: "Plan for this location — no charges yet" },
    "/store/notifications": { title: "Notifications", subtitle: "New asks and team updates" },
    "/store/account": { title: "Account", subtitle: "Your login" },
    "/admin": { title: "Overview", subtitle: "FINDIT network" },
    "/admin/applications": { title: "Applications", subtitle: "Businesses waiting to join" },
    "/admin/stores": { title: "Stores", subtitle: "Open a location for its people and settings" },
    "/admin/subscriptions": { title: "Subscription", subtitle: "Trials and plans — no card charges" },
    "/admin/hubs": { title: "Hubs", subtitle: "Registered counter devices" },
    "/admin/reports": { title: "Reports", subtitle: "Moderation queue" },
    "/admin/analytics": { title: "Analytics", subtitle: "Network size — stores and accounts" },
    "/admin/system": { title: "System", subtitle: "Operator health" },
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

export const STORE_PROFILE_MENU = [
  { href: "/store/settings#profile", label: "Business Profile" },
  { href: "/store/settings#hours", label: "Business Hours" },
  { href: "/store/settings#area", label: "Service Area" },
  { href: "/store/settings#categories", label: "Request Categories" },
  { href: "/store/team", label: "Team" },
  { href: "/store/notifications", label: "Notifications" },
] as const;
