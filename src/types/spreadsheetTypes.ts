export interface Update {
  column: number;
  values: (string | number)[];
  startRow?: number;
}
