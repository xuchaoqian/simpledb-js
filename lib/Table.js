"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Table = void 0;
class Table {
    constructor(name, keyName, store) {
        this._name = name;
        this._keyName = keyName;
        this._store = store;
    }
    put(rows) {
        return this._store.operate("readwrite", (resolve, reject, rawStore) => {
            let errorCount = 0;
            const errorHandler = (event) => {
                errorCount++;
                if (event.stopPropagation) {
                    event.stopPropagation();
                }
                if (event.preventDefault) {
                    event.preventDefault();
                }
            };
            let req;
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const id = this._buildId(row[this._keyName]);
                req = rawStore.put(row, id);
                req.onerror = errorHandler;
            }
            if (typeof req === "undefined") {
                resolve();
                return;
            }
            req.onerror = () => {
                reject(new Error("Failed to execute last request."));
            };
            req.onsuccess = () => {
                if (errorCount > 0) {
                    reject(new Error(`Error occured: count: ${errorCount}`));
                }
                else {
                    resolve();
                }
            };
        });
    }
    deleteSince(startKey) {
        return this._deleteRange(IDBKeyRange.bound(this._buildId(startKey), this._buildLastNextId(), false, true));
    }
    deleteUntil(endKey) {
        return this._deleteRange(IDBKeyRange.bound(this._buildFirstPrevId(), this._buildId(endKey), true, false));
    }
    deleteBetween(startKey, endKey) {
        return this._deleteRange(IDBKeyRange.bound(this._buildId(startKey), this._buildId(endKey), false, false));
    }
    clear() {
        return this._deleteRange(IDBKeyRange.bound(this._buildFirstPrevId(), this._buildLastNextId(), true, true));
    }
    getSince(startKey, limit) {
        return this._getRange(IDBKeyRange.bound(this._buildId(startKey), this._buildLastNextId(), false, true), limit);
    }
    getSinceFirst(limit) {
        return this._getRange(IDBKeyRange.bound(this._buildFirstPrevId(), this._buildLastNextId(), true, true), limit);
    }
    getUntil(endKey, limit) {
        return this._getUntil(endKey, false, limit);
    }
    getUntilLast(limit) {
        return this._getUntil(this._buildLastNextId(), true, limit);
    }
    getBetween(startKey, endKey, limit) {
        return this._getRange(IDBKeyRange.bound(this._buildId(startKey), this._buildId(endKey), false, false), limit);
    }
    getFirstRow() {
        return this._store.operate("readonly", (resolve, reject, rawStore) => {
            const request = rawStore.openCursor(IDBKeyRange.bound(this._buildFirstPrevId(), this._buildLastNextId(), true, true), "next");
            request.onerror = () => {
                reject(new Error("Failed to get first row."));
            };
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    resolve(cursor.value);
                }
                else {
                    resolve(undefined);
                }
            };
        });
    }
    getLastRow() {
        return this._store.operate("readonly", (resolve, reject, rawStore) => {
            const request = rawStore.openCursor(IDBKeyRange.bound(this._buildFirstPrevId(), this._buildLastNextId(), true, true), "prev");
            request.onerror = () => {
                reject(new Error("Failed to get last row."));
            };
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    resolve(cursor.value);
                }
                else {
                    resolve(undefined);
                }
            };
        });
    }
    count() {
        return this._store.operate("readonly", (resolve, reject, rawStore) => {
            const request = rawStore.count(IDBKeyRange.bound(this._buildFirstPrevId(), this._buildLastNextId(), true, true));
            request.onerror = () => {
                reject(new Error("Failed to count table."));
            };
            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
        });
    }
    _deleteRange(range) {
        return this._store.operate("readwrite", (resolve, reject, rawStore) => {
            const request = rawStore.delete(range);
            request.onerror = () => {
                reject(new Error(`Failed to delete range: ${range}`));
            };
            request.onsuccess = () => {
                resolve();
            };
        });
    }
    _getRange(range, limit) {
        return this._store.operate("readonly", (resolve, reject, rawStore) => {
            const request = rawStore.getAll(range, limit);
            request.onerror = () => {
                reject(new Error(`Failed to get range: range: ${range}, limit: ${limit}`));
            };
            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
        });
    }
    _getUntil(endKey, open, limit) {
        return this._store.operate("readonly", (resolve, reject, rawStore) => {
            const request = rawStore.openCursor(IDBKeyRange.bound(this._buildFirstPrevId(), this._buildId(endKey), true, open), "prev");
            request.onerror = () => {
                reject(new Error(`Failed to get until: endKey: ${endKey}, open: ${open}, limit: ${limit}`));
            };
            let hasAdvanced = false;
            request.onsuccess = (event) => {
                const getAll = (range) => {
                    const request = rawStore.getAll(range, limit);
                    request.onerror = () => {
                        reject(new Error(`Failed to get all: range: ${range}, limit: ${limit}`));
                    };
                    request.onsuccess = (event) => {
                        resolve(event.target.result);
                    };
                };
                const cursor = event.target.result;
                if (cursor) {
                    if (!hasAdvanced) {
                        const count = limit - 1;
                        if (count > 0) {
                            cursor.advance(count);
                            hasAdvanced = true;
                        }
                        else {
                            const endId = this._buildId(endKey);
                            getAll(IDBKeyRange.bound(endId, endId, false, false));
                        }
                    }
                    else {
                        getAll(IDBKeyRange.bound(this._buildId(cursor.value[this._keyName]), this._buildId(endKey), false, false));
                    }
                }
                else {
                    if (!hasAdvanced) {
                        resolve([]);
                    }
                    else {
                        getAll(IDBKeyRange.bound(this._buildFirstPrevId(), this._buildId(endKey), true, false));
                    }
                }
            };
        });
    }
    _buildFirstPrevId() {
        return `${this._name}^0`;
    }
    _buildLastNextId() {
        return `${this._name}^2`;
    }
    _buildId(key) {
        if (typeof key === "number" && key < 1000000000) {
            return `${this._name}^1^0${key}`;
        }
        else {
            return `${this._name}^1^${key}`;
        }
    }
}
exports.Table = Table;
exports.default = Table;
//# sourceMappingURL=Table.js.map