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
    }catch(error){
        await client.query('ROLLBACK');
        throw error;
    }finally{
        client.release();
    }
}

module.exports = {transaction};