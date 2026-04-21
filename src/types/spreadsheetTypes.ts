type UpdateItem = {
  accountName: string;
  value: number;
  previousTotal: number;
};

export type Update = {
  fileId: string;
  E: UpdateItem[];
  NE: UpdateItem[];
  D: UpdateItem[];
  ND: UpdateItem[];
  lastDTotal: number;
  lastNDTotal: number;
};

export const isValidKey = (key: string): key is 'E' | 'NE' | 'D' | 'ND' => {
  return ['E', 'NE', 'D', 'ND'].includes(key as any);
};