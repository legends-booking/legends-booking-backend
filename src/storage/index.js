const impl = process.env.STORAGE_IMPL === 'oracle'?
    require('./oci') :
    require('./local');

module.exports = impl;