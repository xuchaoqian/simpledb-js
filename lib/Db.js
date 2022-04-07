"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Db = void 0;
const adler_32_1 = require("adler-32");
const internal_1 = require("./internal");
class Db {
    constructor(name, storeCount, rawDb) {
        this._name = name;
        this._storeCount = storeCount;
        this._rawDb = rawDb;
        this._shouldReopen = true;
        rawDb.onclose = () => {
            console.log(`Db closed: name: ${name}`);
            this._tryOpenLater(500);
        };
    }
    static open(dbName, storeCount = 64) {
        return Db._open(dbName, storeCount).then((rawDb) => {
            return new Db(dbName, storeCount, rawDb);
        });
    }
    close() {
        var _a;
        this._shouldReopen = false;
        (_a = this._rawDb) === null || _a === void 0 ? void 0 : _a.close();
    }
    static destroy(dbName) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(dbName);
            request.onerror = () => {
                const reason = `Failed to delete db: name: ${dbName}`;
                console.error(reason);
                reject(reason);
            };
            request.onsuccess = () => {
                console.log(`Db destroyed: name: ${dbName}`);
                resolve();
            };
        });
    }
    createTable(tableName, keyName) {
        return new Promise((resolve) => {
            const storeName = this._selectStoreName(tableName);
            resolve(new internal_1.Table(tableName, keyName, new internal_1.Store(storeName, this)));
        });
    }
    destroyTable(tableName) {
        return new Promise((resolve, reject) => {
            const storeName = this._selectStoreName(tableName);
            new internal_1.Table(tableName, "", new internal_1.Store(storeName, this))
                .clear()
                .then(() => resolve())
                .catch((reason) => reject(reason));
        });
    }
    createTransaction(storeName, mode) {
        return this._rawDb.transaction(storeName, mode, {
            durability: "relaxed",
        });
    }
    static _open(dbName, storeCount = 64) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName);
            request.onerror = () => {
                const reason = `Failed to open db: name: ${dbName}`;
                console.error(reason);
                reject(new Error(reason));
            };
            request.onsuccess = (event) => {
                const result = event.target.result;
                console.log(`Open db successfully: name: ${dbName}, version: ${result.version}`);
                resolve(result);
            };
            request.onupgradeneeded = (event) => {
                const rawDb = event.target.result;
                for (let index = 0; index < storeCount; index++) {
                    rawDb.createObjectStore(this._buildStoreName(dbName, index));
                }
            };
        });
    }
    _tryOpenLater(ms) {
        if (!this._shouldReopen) {
            return;
        }
        setTimeout(() => {
            Db._open(this._name, this._storeCount)
                .then((rawDb) => {
                this._rawDb = rawDb;
            })
                .catch((reason) => {
                console.error(`Failed to open db: name: ${this._name}, reason: ${reason}, will try again...`);
                this._tryOpenLater(ms);
            });
        }, ms);
    }
    _selectStoreName(tableName) {
        const index = Math.abs((0, adler_32_1.str)(tableName)) % this._storeCount;
        return Db._buildStoreName(this._name, index);
    }
    static _buildStoreName(dbName, index) {
        return `${dbName}_${index}`;
    }
}
exports.Db = Db;
exports.default = Db;
//# sourceMappingURL=Db.js.map