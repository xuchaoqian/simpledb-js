import { Store, Row, Key } from "./internal";
export declare class Table<R extends Row = Row> {
    private _name;
    private _keyName;
    private _store;
    constructor(name: string, keyName: keyof R, store: Store);
    put(rows: R[]): Promise<void>;
    deleteSince(startKey: Key): Promise<void>;
    deleteUntil(endKey: Key): Promise<void>;
    deleteBetween(startKey: Key, endKey: Key): Promise<void>;
    clear(): Promise<void>;
    getSince(startKey: Key, limit: number): Promise<R[]>;
    getSinceFirst(limit: number): Promise<R[]>;
    getUntil(endKey: Key, limit: number): Promise<R[]>;
    getUntilLast(limit: number): Promise<R[]>;
    getBetween(startKey: Key, endKey: Key, limit: number): Promise<R[]>;
    getFirstRow(): Promise<R | undefined>;
    getLastRow(): Promise<R | undefined>;
    count(): Promise<number>;
    private _deleteRange;
    private _getRange;
    private _getUntil;
    private _buildFirstPrevId;
    private _buildLastNextId;
    private _buildId;
}
export default Table;
