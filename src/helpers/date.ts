import { fromUnixTime } from 'date-fns';

// Formats using UTC components rather than the viewer's local timezone, so a
// date read back in a different timezone than it was picked in still shows
// the same day (see toUTCDateOnly below for how dates are anchored on write).
const formatUTC = (date: Date): string => {
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  const year = (date.getUTCFullYear() % 100).toString().padStart(2, '0');
  return `${month}/${day}/${year}`;
};

export const formatFirestoreDate = (timestamp: any): string => {
  if (!timestamp) return '';

  // Handle Firestore Timestamp object
  if (timestamp.seconds !== undefined) {
    return formatUTC(fromUnixTime(timestamp.seconds));
  }

  // Handle regular Date object
  if (timestamp instanceof Date) {
    return formatUTC(timestamp);
  }

  // Handle string date
  if (typeof timestamp === 'string') {
    return formatUTC(new Date(timestamp));
  }

  return '';
};

/**
 * Anchors a calendar date (read from its local Y/M/D components, e.g. as
 * selected in a date picker) to UTC midnight, so the same day survives being
 * stored and later read back in a different timezone than it was picked in.
 */
export const toUTCDateOnly = (date: Date): Date =>
  new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

/**
 * Inverse of toUTCDateOnly: takes a stored value (Firestore Timestamp-like,
 * Date, or date string) and returns a local Date with the same Y/M/D as the
 * stored UTC day, so a date picker displays the right calendar day and, if
 * re-submitted unchanged, round-trips through toUTCDateOnly to the same value.
 */
export const fromUTCDateOnly = (timestamp: any): Date => {
  let date: Date;

  if (timestamp?.seconds !== undefined) {
    date = fromUnixTime(timestamp.seconds);
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    date = new Date();
  }

  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

/**
 * Converts a Firestore Timestamp-like object, Date, or date string into a
 * millisecond epoch value for sorting/comparison purposes.
 */
export const toComparableTime = (timestamp: any): number => {
  if (!timestamp) return 0;

  if (timestamp.seconds !== undefined) {
    return fromUnixTime(timestamp.seconds).getTime();
  }

  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }

  if (typeof timestamp === 'string') {
    return new Date(timestamp).getTime();
  }

  return 0;
};