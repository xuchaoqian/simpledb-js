"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Store = void 0;
class Store {
    constructor(name, db) {
        this._name = name;
        this._db = db;
    }
    operate(mode, operation) {
        return new Promise((resolve, reject) => {
            const transaction = this._db.createTransaction(this._name, mode);
            const rawStore = transaction.objectStore(this._name);
            operation(resolve, reject, rawStore, transaction);
        });
    }
}
exports.Store = Store;
exports.default = Store;
//# sourceMappingURL=Store.js.map