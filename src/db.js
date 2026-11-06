import Dexie from 'dexie'
export const db = new Dexie('life-ledger-local-v1')
db.version(1).stores({ trips: '++id,name', records: '++id,tripId,time,category,merchant,&fingerprint', rules: '++id,keyword' })
