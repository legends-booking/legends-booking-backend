const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { query } = require('../db/pool');
const multer = require('multer');
const storage = require('../storage');


const router = express.Router();


const upload = multer({
    storage: multer.memoryStorage(),
    limits:{fileSize: 5 * 1024 * 1024}, // 5MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    }
});

router.get('/', asyncHandler(async (req, res) => {
        const { rows } = await query('SELECT * FROM membership_plan',[]);
        res.json(rows);
    }),
);

router.post('/', upload.single('image'), asyncHandler(async(req, res) =>{
    const {name, description, image, price, credits} = req.body;
    if(!name || !price){
        return res.status(400).json({error: 'Missing Required Fields'});
    }
    let imageUrl = null;   
    if(req.file){
        try{
            imageUrl = await storage.uploadFile(req.file);
       }catch(error){
           console.log(`Error uploading image: ${error.message}`);
       }
    }
    const { rows: [plan] } = await query('INSERT INTO membership_plan (name, description, image, price, class_credits) '+
        'VALUES ($1, $2, $3, $4, $5) RETURNING *', 
        [name, description, imageUrl, price, credits]);
    res.status(201).json(plan);
    }),
);

module.exports = router;