const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
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

function uploadImage(req,res,next)  {
    upload.single('image')(req,res, (err) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            console.log('File size exceeds the limit of 5MB');
            return res.status(400).json({error: 'File size exceeds the limit of 5MB'});
        }
        if (err) return  next(err);
        next();
    })

}

router.get('/', asyncHandler(async (req, res) => {
        const { rows } = await query('SELECT * FROM membership_plan',[]);
        res.json(rows);
    }),
);

router.post('/', requireAuth, requireRole('admin'), uploadImage, asyncHandler(async(req, res) =>{
    const {name, description, price, credits} = req.body;
    const priceFloat = parseFloat(price);
    const creditsInt = parseInt(credits);
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
        [name, description, imageUrl, priceFloat, creditsInt]);
    res.status(201).json(plan);
    }),
);

module.exports = router;