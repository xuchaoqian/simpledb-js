import { Table, Row, toTableNames, extractErrorMsg } from "./internal";

export class Db {
  private _name: string;
  private _rawDb: IDBDatabase;
  private _tableNames: Set<string>;
  private _shouldReopen: boolean;

  /** @internal */
  private constructor(name: string, rawDb: IDBDatabase) {
    this._name = name;
    this._rawDb = rawDb;
    this._tableNames = toTableNames(rawDb.objectStoreNames);
    this._shouldReopen = true;

    rawDb.onclose = () => {
      console.log(`Db was closed: name: ${name}`);
      rawDb.close();
      this._tryReopenLater(200);
    };
    rawDb.onabort = () => {
      console.log(`Db was aborted: name: ${name}`);
      rawDb.close();
      this._tryReopenLater(200);
    };
    rawDb.onerror = () => {
      console.log(`Error occured: name: ${name}`);
      rawDb.close();
      this._tryReopenLater(200);
    };
    rawDb.onversionchange = (event: IDBVersionChangeEvent) => {
      console.log(
        `Version was changed: name: ${name}, old: ${event.oldVersion}, new: ${event.newVersion}`
      );
      rawDb.close();
      if (event.newVersion !== null && event.newVersion > this._rawDb.version) {
        this._tryReopenLater(200);
      }
    };
  }

  static open(name: string): Promise<Db> {
    return Db._open(name, undefined, () => {}).then((rawDb: IDBDatabase) => {
      return new Db(name, rawDb);
    });
  }

  close(): void {
    this._shouldReopen = false;
    this._rawDb.close();
  }

  static destroy(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onerror = (event: Event) => {
        const errorMsg = extractErrorMsg(event);
        console.error(`Failed to open db: name: ${name}, error: ${errorMsg}`);
        reject(new Error(errorMsg));
      };
      request.onblocked = (/*event: Event*/) => {
        const reason = `Db was blocked when destroying: name: ${name}`;
        console.error(reason);
        reject(new Error(reason));
      };
      request.onsuccess = () => {
        console.log(`Db was destroyed: name: ${name}`);
        resolve();
      };
    });
  }

  /** @internal */
  getRawDb(): IDBDatabase {
    return this._rawDb;
  }

  openTable<R extends Row>(
    tableName: string,
    keyColName: keyof R
  ): Promise<Table<R>> {
    return new Promise((resolve, reject) => {
      if (this._tableNames.has(tableName)) {
        resolve(new Table(tableName, keyColName, this));
        return;
      }
      const newVersion = this._rawDb.version + 1;
      this._rawDb.close();
      Db._open(this._name, newVersion, (event: IDBVersionChangeEvent) => {
        const rawDb = (event.target as IDBRequest).result;
        rawDb.createObjectStore(tableName);
      })
        .then((rawDb: IDBDatabase) => {
          this._rawDb = rawDb;
          this._tableNames.add(tableName);
          resolve(new Table(tableName, keyColName, this));
        })
        .catch((error: Error) => {
          reject(error);
        });
    });
  }

  destroyTable(tableName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const newVersion = this._rawDb.version + 1;
      this._rawDb.close();
      Db._open(this._name, newVersion, (event: IDBVersionChangeEvent) => {
        const rawDb = (event.target as IDBRequest).result;
        rawDb.deleteObjectStore(tableName);
      })
        .then((rawDb: IDBDatabase) => {
          this._rawDb = rawDb;
          this._tableNames.delete(tableName);
          resolve();
        })
        .catch((error: Error) => {
          reject(error);
        });
    });
  }

  private static _open(
    name: string,
    version: number | undefined,
    onupgradeneeded: (event: IDBVersionChangeEvent) => void
  ): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request =
        typeof version !== "undefined"
          ? indexedDB.open(name, version)
          : indexedDB.open(name);
      request.onerror = (event: Event) => {
        const errorMsg = extractErrorMsg(event);
        console.error(`Failed to open db: name: ${name}, error: ${errorMsg}`);
        reject(new Error(errorMsg));
      };
      request.onblocked = (/*event: Event*/) => {
        const reason = `Db was blocked when opening: name: ${name}`;
        console.error(reason);
        reject(new Error(reason));
      };
      request.onsuccess = (event: Event) => {
        const rawDb = (event.target as IDBRequest).result;
        console.log(
          `Open db successfully: name: ${name}, version: ${rawDb.version}`
        );
        resolve(rawDb);
      };
      request.onupgradeneeded = onupgradeneeded;
    });
  }

  private _tryReopenLater(ms: number) {
    if (!this._shouldReopen) {
      return;
    }
    setTimeout(() => {
      Db._open(this._name, undefined, () => {})
        .then((rawDb) => {
          this._rawDb = rawDb;
          this._tableNames = toTableNames(rawDb.objectStoreNames);
        })
        .catch((reason) => {
          console.error(
            `Failed to open db: name: ${this._name}, reason: ${reason}, will try again...`
          );
          this._tryReopenLater(ms);
        });
    }, ms);
  }
}

export default Db;
