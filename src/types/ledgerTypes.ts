export interface Ledger {
  id: string;
  name: string;
  userId: string;
  dateCreated: Date;
  parentId: string | null;
}