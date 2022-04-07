import { Db, toObjectStoreName, extractErrorMsg } from "./internal";

export type Row = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type KeyColType = number | string;

export class Table<R extends Row = Row> {
  private _name: string;
  private _keyColName: keyof R;
  private _db: Db;

  /** @internal */
  constructor(name: string, keyColName: keyof R, db: Db) {
    this._name = name;
    this._keyColName = keyColName;
    this._db = db;
  }

  put(rows: R[]): Promise<void> {
    return this._openTransaction(
      "readwrite",
      (resolve, reject, rawStore: IDBObjectStore) => {
        let errorCount = 0;

        const errorHandler = (event: Event) => {
          errorCount++;
          if (event.stopPropagation) {
            // IndexedDBShim doesnt support this on Safari 8 and below.
            event.stopPropagation();
          }
          if (event.preventDefault) {
            // IndexedDBShim doesnt support this on Safari 8 and below.
            event.preventDefault();
          }
        };

        let request: IDBRequest | undefined;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const id = row[this._keyColName];
          request = rawStore.put(row, id);
          request.onerror = errorHandler;
        }
        if (typeof request === "undefined") {
          resolve();
          return;
        }

        /**Set event handler for last request.*/
        request.onerror = (event: Event) => {
          reject(
            new Error(
              `Failed to put last row: error: ${extractErrorMsg(event)}`
            )
          );
        };
        request.onsuccess = () => {
          if (errorCount > 0) {
            reject(new Error(`Error occured: count: ${errorCount}`));
          } else {
            resolve();
          }
        };
      }
    );
  }

  deleteSince(startKey: KeyColType): Promise<void> {
    return this._deleteRange(IDBKeyRange.lowerBound(startKey, false));
  }

  deleteUntil(endKey: KeyColType): Promise<void> {
    return this._deleteRange(IDBKeyRange.upperBound(endKey, false));
  }

  deleteBetween(startKey: KeyColType, endKey: KeyColType): Promise<void> {
    return this._deleteRange(IDBKeyRange.bound(startKey, endKey, false, false));
  }

  clear(): Promise<void> {
    return this._openTransaction(
      "readwrite",
      (resolve, reject, rawStore: IDBObjectStore) => {
        const request = rawStore.clear();
        request.onerror = (event: Event) => {
          reject(
            new Error(`Failed to clear: error: ${extractErrorMsg(event)}`)
          );
        };
        request.onsuccess = (/*event: Event*/) => {
          resolve();
        };
      }
    );
  }

  getAll(): Promise<R[]> {
    return this._openTransaction(
      "readonly",
      (resolve, reject, rawStore: IDBObjectStore) => {
        const request = rawStore.getAll();
        request.onerror = (event: Event) => {
          reject(
            new Error(`Failed to get all: error: ${extractErrorMsg(event)}`)
          );
        };
        request.onsuccess = (event: Event) => {
          resolve((event.target as IDBRequest).result);
        };
      }
    );
  }

  getSince(startKey: KeyColType, limit: number): Promise<R[]> {
    return this._getRange(IDBKeyRange.lowerBound(startKey, false), limit);
  }

  getSinceFirst(limit: number): Promise<R[]> {
    return this._openTransaction(
      "readonly",
      (resolve, reject, rawStore: IDBObjectStore) => {
        const request = rawStore.openCursor(null, "next");
        request.onerror = (event: Event) => {
          reject(
            new Error(`Failed to open cursor: error: ${extractErrorMsg(event)}`)
          );
        };
        const getRange = (range: IDBKeyRange) => {
          const request = rawStore.getAll(range, limit);
          request.onerror = (event: Event) => {
            reject(
              new Error(`Failed to get all: error: ${extractErrorMsg(event)}`)
            );
          };
          request.onsuccess = (event: Event) => {
            resolve((event.target as IDBRequest).result);
          };
        };
        request.onsuccess = (event: Event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            getRange(
              IDBKeyRange.lowerBound(cursor.value[this._keyColName], false)
            );
          } else {
            resolve([]);
          }
        };
      }
    );
  }

  getUntil(endKey: KeyColType, limit: number): Promise<R[]> {
    return this._getUntil(IDBKeyRange.upperBound(endKey, false), limit);
  }

  getUntilLast(limit: number): Promise<R[]> {
    return this._getUntil(null, limit);
  }

  getBetween(
    startKey: KeyColType,
    endKey: KeyColType,
    limit: number
  ): Promise<R[]> {
    return this._getRange(
      IDBKeyRange.bound(startKey, endKey, false, false),
      limit
    );
  }

  getFirstRow(): Promise<R | undefined> {
    return this._openTransaction(
      "readonly",
      (resolve, reject, rawStore: IDBObjectStore) => {
        const request = rawStore.openCursor(null, "next");
        request.onerror = (event: Event) => {
          reject(
            new Error(
              `Failed to open cursor: : error: ${extractErrorMsg(event)}`
            )
          );
        };
        request.onsuccess = (event: Event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            resolve(cursor.value);
          } else {
            resolve(undefined);
          }
        };
      }
    );
  }

  getLastRow(): Promise<R | undefined> {
    return this._openTransaction(
      "readonly",
      (resolve, reject, rawStore: IDBObjectStore) => {
        const request = rawStore.openCursor(null, "prev");
        request.onerror = (event: Event) => {
          reject(
            new Error(
              `Failed to get last row: error: ${extractErrorMsg(event)}`
            )
          );
        };
        request.onsuccess = (event: Event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            resolve(cursor.value);
          } else {
            resolve(undefined);
          }
        };
      }
    );
  }

  count(): Promise<number> {
    return this._openTransaction(
      "readonly",
      (resolve, reject, rawStore: IDBObjectStore) => {
        const request = rawStore.count();
        request.onerror = (event: Event) => {
          reject(
            new Error(`Failed to count: error: ${extractErrorMsg(event)}`)
          );
        };
        request.onsuccess = (event: Event) => {
          resolve((event.target as IDBRequest).result);
        };
      }
    );
  }

  private _deleteRange(range: IDBKeyRange): Promise<void> {
    return this._openTransaction(
      "readwrite",
      (resolve, reject, rawStore: IDBObjectStore) => {
        const request = rawStore.delete(range);
        request.onerror = (event: Event) => {
          reject(
            new Error(
              `Failed to delete range: error: ${extractErrorMsg(event)}`
            )
          );
        };
        request.onsuccess = () => {
          resolve();
        };
      }
    );
  }

  private _getRange(range: IDBKeyRange, limit: number): Promise<R[]> {
    return this._openTransaction(
      "readonly",
      (resolve, reject, rawStore: IDBObjectStore) => {
        const request = rawStore.getAll(range, limit);
        request.onerror = (event: Event) => {
          reject(
            new Error(`Failed to get range: error: ${extractErrorMsg(event)}`)
          );
        };
        request.onsuccess = (event: Event) => {
          resolve((event.target as IDBRequest).result);
        };
      }
    );
  }

  private _getUntil(query: IDBKeyRange | null, limit: number): Promise<R[]> {
    return this._openTransaction(
      "readonly",
      (resolve, reject, rawStore: IDBObjectStore) => {
        const request = rawStore.openCursor(query, "prev");
        request.onerror = (event: Event) => {
          reject(
            new Error(`Failed to get until: error: ${extractErrorMsg(event)}`)
          );
        };
        let hasAdvanced = false;
        let lastKey: keyof R | undefined = undefined;
        const getRange = (range: IDBKeyRange) => {
          const request = rawStore.getAll(range, limit);
          request.onerror = (event: Event) => {
            reject(
              new Error(`Failed to get range: error: ${extractErrorMsg(event)}`)
            );
          };
          request.onsuccess = (event: Event) => {
            resolve((event.target as IDBRequest).result);
          };
        };
        request.onsuccess = (event: Event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            if (!hasAdvanced) {
              lastKey = cursor.value[this._keyColName];
              const count = limit - 1;
              if (count < 0) {
                resolve([]);
              } else if (count === 0) {
                resolve([cursor.value]);
              } else {
                cursor.advance(count);
                hasAdvanced = true;
              }
            } else {
              getRange(
                IDBKeyRange.bound(
                  cursor.value[this._keyColName],
                  lastKey,
                  false,
                  false
                )
              );
            }
          } else {
            console.log(cursor);
            if (!hasAdvanced) {
              // Don't get any match records.
              resolve([]);
            } else {
              // Beyond the first record.
              if (typeof lastKey === "undefined") {
                resolve([]);
              } else {
                getRange(IDBKeyRange.upperBound(lastKey, false));
              }
            }
          }
        };
      }
    );
  }

  _openTransaction<T>(
    mode: IDBTransactionMode,
    operation: (
      resolve: (value: T) => void,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reject: (value: any) => void,
      rawStore: IDBObjectStore,
      transaction?: IDBTransaction
    ) => void
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const objectStoreName = toObjectStoreName(this._name);
      const transaction = this._db
        .getRawDb()
        // @ts-expect-error: Expected 1-2 arguments, but got 3
        .transaction(objectStoreName, mode, {
          durability: "relaxed",
        });
      const rawStore = transaction.objectStore(objectStoreName);
      operation(resolve, reject, rawStore, transaction);
    });
  }
}

export default Table;
