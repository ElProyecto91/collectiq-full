import type { Translation } from '@/i18n';
import type { LegoSetStatus } from './types';

export function statusLabel(t: Translation, status: LegoSetStatus): string {
  switch (status) {
    case 'sealed': return t.lego.statusSealed;
    case 'open_complete': return t.lego.statusOpenComplete;
    case 'incomplete': return t.lego.statusIncomplete;
  }
}
