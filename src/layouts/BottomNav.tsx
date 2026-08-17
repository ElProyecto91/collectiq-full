import { NavLink } from 'react-router-dom';
import { Compass, Users, Home, LayoutGrid, User, type LucideIcon } from 'lucide-react';

import { NAV_ITEMS, RoutePaths } from '@/config';
import type { NavItem } from '@/config';
import { cx } from '@/utils';
import { useI18n } from '@/i18n';

const ICONS: Record<NavItem['icon'], LucideIcon> = {
  Home,
  LayoutGrid,
  Compass,
  Users,
  User,
};

export function BottomNav() {
  const { t } = useI18n();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 glass-strong"
      style={{ paddingBottom: 'var(--tg-safe-bottom)' }}
      aria-label={t.nav.ariaPrimary}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon];
          const label = resolveNavLabel(t, item.labelKey);
          return (
            <li key={item.id} className="flex-1">
              <NavLink
                to={item.path}
                end={item.path === RoutePaths.Home}
                className={({ isActive }) =>
                  cx(
                    'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors duration-[var(--duration-base)]',
                    isActive ? 'text-primary-soft' : 'text-ink-muted hover:text-ink-soft'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cx(
                        'flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-[var(--duration-base)] ease-[var(--ease-premium)]',
                        isActive
                          ? 'bg-primary/15 scale-105'
                          : 'scale-100'
                      )}
                    >
                      <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function resolveNavLabel(
  t: ReturnType<typeof useI18n>['t'],
  key: string
): string {
  const parts = key.split('.');
  let current: unknown = t;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return typeof current === 'string' ? current : key;
}
