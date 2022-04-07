export function toTableNames(objectStoreNames: DOMStringList): Set<string> {
  const rawStoreNames = new Set<string>();
  for (const rawStoreName of objectStoreNames) {
    rawStoreNames.add(rawStoreName);
  }
  return rawStoreNames;
}

export function toObjectStoreName(tableName: string): string {
  return tableName;
}

export function extractErrorMsg(event: Event): string {
  return ((event.target as IDBRequest).error as DOMException).message;
}
