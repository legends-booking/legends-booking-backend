const { pool } = require('../db/pool');

/**
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn 
 * @returns {Promise<T>}
 */
async function transaction(fn) {
    const client = await pool.connect();
    try{
        await client.query('BEGIN');
        const result= await fn(client);
        await client.query('COMMIT');
        return result;
    }catch(err){
        console.log('Transaction rolled back', err.message)
        await client.query('ROLLBACK');
        throw err;
    }finally{
        client.release();
    }
}

module.exports = {transaction};