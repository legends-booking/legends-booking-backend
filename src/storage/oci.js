const path = require('path');
const fs = require('fs').promises;

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
async function uploadFile(file){
    const filename = `${Date.now()}-${file.originalname}`;

    await fs.writeFile(path.join(UPLOAD_DIR, filename), file.buffer);

    return `/uploads/${filename}`;
}

module.exports = {
    uploadFile
}