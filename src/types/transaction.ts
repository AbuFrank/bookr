export interface Transaction {
  id: string;
  accountName: string;
  accountNumber: string;
  value: number;
  type: 'income' | 'expense';
  date: Date;
}