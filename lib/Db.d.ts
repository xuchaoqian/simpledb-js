import { Table, Row } from "./internal";
export declare class Db {
    private _name;
    private _storeCount;
    private _rawDb?;
    private _shouldReopen;
    constructor(name: string, storeCount: number, rawDb: IDBDatabase);
    static open(dbName: string, storeCount?: number): Promise<Db>;
    close(): void;
    static destroy(dbName: string): Promise<void>;
    createTable<R extends Row>(tableName: string, keyName: keyof R): Promise<Table<R>>;
    destroyTable(tableName: string): Promise<void>;
    createTransaction(storeName: string, mode: IDBTransactionMode): IDBTransaction;
    private static _open;
    private _tryOpenLater;
    private _selectStoreName;
    private static _buildStoreName;
}
export default Db;
