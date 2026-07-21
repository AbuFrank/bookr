import { format, fromUnixTime } from 'date-fns';

export const formatFirestoreDate = (timestamp: any): string => {
  if (!timestamp) return '';

  // Handle Firestore Timestamp object
  if (timestamp.seconds !== undefined) {
    const date = fromUnixTime(timestamp.seconds);
    return format(date, "MM/dd/yy");
  }

  // Handle regular Date object
  if (timestamp instanceof Date) {
    return format(timestamp, "MM/dd/yy");
  }

  // Handle string date
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    return format(date, "MM/dd/yy");
  }

  return '';
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