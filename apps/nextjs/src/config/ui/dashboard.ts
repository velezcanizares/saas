import type { Locale } from "~/config/i18n-config";
import { getDictionary } from "~/lib/get-dictionary";
import type { DashboardConfig } from "~/types";

export const getDashboardConfig = async ({
  params: { lang },
}: {
  params: {
    lang: Locale;
  };
}): Promise<DashboardConfig> => {
  const dict = await getDictionary(lang);

  return {
    mainNav: [
      {
        title: dict.common.dashboard.main_nav_documentation,
        href: "/docs",
      },
      {
        title: dict.common.dashboard.main_nav_support,
        href: "/support",
        disabled: true,
      },
    ],
    sidebarNav: [
      {
        id: "reports",
        title: "Reportes",
        href: "/dashboard/reports",
      },
      {
        id: "pos",
        title: "Vender",
        href: "/dashboard/pos",
      },
      {
        id: "sales",
        title: "Ventas",
        href: "/dashboard/sales",
      },
      {
        id: "catalog",
        title: "Catálogo",
        href: "/dashboard/catalog",
      },
      {
        id: "expenses",
        title: "Egresos",
        href: "/dashboard/expenses",
      },
      {
        id: "billing",
        title: dict.common.dashboard.sidebar_nav_billing,
        href: "/dashboard/billing",
      },
      {
        id: "settings",
        title: dict.common.dashboard.sidebar_nav_settings,
        href: "/dashboard/settings",
      },
    ],
  };
};
